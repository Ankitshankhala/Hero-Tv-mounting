import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { booking_id, send_email = true, force_regenerate = false } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log(`[GENERATE-INVOICE] Processing invoice for booking: ${booking_id}`);

    // Check if invoice already exists (prevent duplicates)
    const { data: existingInvoice } = await supabaseClient
      .from('invoices')
      .select('id, invoice_number, status, email_sent')
      .eq('booking_id', booking_id)
      .maybeSingle();

    if (existingInvoice && !force_regenerate) {
      console.log(`[GENERATE-INVOICE] Invoice already exists: ${existingInvoice.invoice_number}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Invoice already exists',
          invoice: existingInvoice,
          regenerated: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fetch booking details with customer, service, and transaction information
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(id, name, email, phone, city, zip_code),
        service:services(id, name, base_price),
        worker:users!bookings_worker_id_fkey(id, name, email, phone),
        booking_services(id, service_id, service_name, base_price, quantity, configuration)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message || 'Unknown error'}`);
    }

    // Determine customer information (handle both authenticated and guest customers)
    let customerEmail: string;
    let customerName: string;
    let customerId: string | null;
    let customerCity: string;
    let customerState: string;

    if (booking.customer_id) {
      // Authenticated customer
      customerId = booking.customer_id;
      customerEmail = booking.customer.email;
      customerName = booking.customer.name || 'Customer';
      customerCity = booking.customer.city || '';
      
      // Get state from ZIP code
      const { data: zipData } = await supabaseClient
        .from('us_zip_codes')
        .select('state_abbr')
        .eq('zipcode', booking.customer.zip_code || '')
        .maybeSingle();
      customerState = zipData?.state_abbr || 'TX';
    } else if (booking.guest_customer_info) {
      // Guest customer
      customerId = null;
      customerEmail = booking.guest_customer_info.email;
      customerName = booking.guest_customer_info.name || 'Guest Customer';
      customerCity = booking.guest_customer_info.city || '';
      
      // Get state from guest ZIP
      const { data: zipData } = await supabaseClient
        .from('us_zip_codes')
        .select('state_abbr')
        .eq('zipcode', booking.guest_customer_info.zipcode || '')
        .maybeSingle();
      customerState = zipData?.state_abbr || 'TX';
    } else {
      throw new Error('No customer information found for booking');
    }

    // Calculate invoice amounts from booking services or base service
    let subtotal = 0;
    const invoiceItems: Array<{
      service_name: string;
      description: string | null;
      quantity: number;
      unit_price: number;
      total_price: number;
    }> = [];

    if (booking.booking_services && booking.booking_services.length > 0) {
      // Use booking services
      for (const bs of booking.booking_services) {
        const itemTotal = bs.base_price * bs.quantity;
        subtotal += itemTotal;
        
        invoiceItems.push({
          service_name: bs.service_name,
          description: bs.configuration ? JSON.stringify(bs.configuration) : null,
          quantity: bs.quantity,
          unit_price: bs.base_price,
          total_price: itemTotal
        });
      }
    } else if (booking.service) {
      // Use base service
      subtotal = booking.service.base_price;
      invoiceItems.push({
        service_name: booking.service.name,
        description: null,
        quantity: 1,
        unit_price: booking.service.base_price,
        total_price: booking.service.base_price
      });
    } else {
      throw new Error('No service information found for booking');
    }

    // Get tax rate for customer's state
    const { data: taxRateData } = await supabaseClient
      .from('state_tax_rates')
      .select('tax_rate')
      .eq('state_code', customerState)
      .eq('is_active', true)
      .maybeSingle();

    const taxRate = taxRateData?.tax_rate || 0;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    console.log(`[GENERATE-INVOICE] Calculated amounts - Subtotal: $${subtotal}, Tax: $${taxAmount}, Total: $${totalAmount}`);

    // Determine invoice status based on payment transactions
    const { data: transactions } = await supabaseClient
      .from('transactions')
      .select('status, amount, transaction_type')
      .eq('booking_id', booking_id)
      .eq('status', 'completed')
      .in('transaction_type', ['capture', 'charge']);

    const totalPaid = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    let invoiceStatus = 'draft';
    
    if (totalPaid >= totalAmount) {
      invoiceStatus = 'paid';
    } else if (booking.status === 'confirmed' || booking.payment_status === 'authorized') {
      invoiceStatus = 'issued';
    }

    // Generate or reuse invoice number
    let invoiceNumber: string;
    let invoiceId: string;

    if (existingInvoice && force_regenerate) {
      // Void the old invoice
      await supabaseClient
        .from('invoices')
        .update({
          status: 'void',
          void_at: new Date().toISOString(),
          void_reason: 'Regenerated by system'
        })
        .eq('id', existingInvoice.id);

      console.log(`[GENERATE-INVOICE] Voided old invoice: ${existingInvoice.invoice_number}`);
    }

    // Generate new invoice number
    const { data: invoiceNumberData, error: invoiceNumberError } = await supabaseClient
      .rpc('generate_invoice_number');

    if (invoiceNumberError) {
      throw new Error(`Failed to generate invoice number: ${invoiceNumberError.message}`);
    }

    invoiceNumber = invoiceNumberData;

    // Create new invoice
    const { data: newInvoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .insert({
        booking_id: booking_id,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0], // Same day for services
        amount: subtotal,
        tax_amount: taxAmount,
        tax_rate: taxRate,
        total_amount: totalAmount,
        state_code: customerState,
        status: invoiceStatus,
        email_sent: false,
        delivery_status: 'pending',
        pdf_generated: false,
        business_license: 'TX-123456789'
      })
      .select()
      .single();

    if (invoiceError || !newInvoice) {
      throw new Error(`Failed to create invoice: ${invoiceError?.message || 'Unknown error'}`);
    }

    invoiceId = newInvoice.id;
    console.log(`[GENERATE-INVOICE] Created invoice: ${invoiceNumber} (${invoiceId})`);

    // Create invoice items
    const invoiceItemsData = invoiceItems.map(item => ({
      invoice_id: invoiceId,
      ...item
    }));

    const { error: itemsError } = await supabaseClient
      .from('invoice_items')
      .insert(invoiceItemsData);

    if (itemsError) {
      console.error('[GENERATE-INVOICE] Failed to create invoice items:', itemsError);
      // Don't fail the whole operation, just log the error
    }

    // Send email if requested
    if (send_email && customerEmail) {
      console.log(`[GENERATE-INVOICE] Sending invoice email to: ${customerEmail}`);
      
      try {
        const emailResponse = await supabaseClient.functions.invoke('unified-email-dispatcher', {
          body: {
            bookingId: booking_id,
            recipientEmail: customerEmail,
            emailType: 'invoice'
          }
        });

        if (emailResponse.error) {
          console.error('[GENERATE-INVOICE] Email send failed:', emailResponse.error);
          // Update invoice with failed email attempt
          await supabaseClient
            .from('invoices')
            .update({
              last_email_attempt: new Date().toISOString(),
              email_attempts: (newInvoice.email_attempts || 0) + 1,
              delivery_status: 'failed'
            })
            .eq('id', invoiceId);
        } else {
          console.log('[GENERATE-INVOICE] Email sent successfully');
          // Update invoice with successful email
          await supabaseClient
            .from('invoices')
            .update({
              email_sent: true,
              email_sent_at: new Date().toISOString(),
              last_email_attempt: new Date().toISOString(),
              email_attempts: (newInvoice.email_attempts || 0) + 1,
              delivery_status: 'sent'
            })
            .eq('id', invoiceId);
        }
      } catch (emailError) {
        console.error('[GENERATE-INVOICE] Email error:', emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: force_regenerate ? 'Invoice regenerated successfully' : 'Invoice generated successfully',
        invoice: {
          id: invoiceId,
          invoice_number: invoiceNumber,
          status: invoiceStatus,
          total_amount: totalAmount,
          email_sent: send_email && customerEmail ? true : false
        },
        regenerated: force_regenerate
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[GENERATE-INVOICE] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
