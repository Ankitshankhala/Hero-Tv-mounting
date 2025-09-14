import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UNIFIED-INVOICE-GENERATOR] ${step}${detailsStr}`);
};

interface InvoiceRequest {
  booking_id?: string;
  booking_ids?: string[]; // For batch processing
  transaction_id?: string;
  trigger_source?: string;
  send_email?: boolean;
  force_regenerate?: boolean;
  invoice_type?: 'standard' | 'enhanced' | 'batch';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      booking_id, 
      booking_ids = [],
      transaction_id,
      trigger_source = 'manual', 
      send_email = true,
      force_regenerate = false,
      invoice_type = 'standard'
    }: InvoiceRequest = await req.json();

    logStep('Starting unified invoice generation', { 
      invoice_type,
      booking_id: booking_id ? 'provided' : null,
      batch_count: booking_ids.length,
      trigger_source,
      send_email
    });

    // Determine which bookings to process
    let targetBookingIds: string[] = [];
    
    if (booking_id) {
      targetBookingIds = [booking_id];
    } else if (booking_ids.length > 0) {
      targetBookingIds = booking_ids;
    } else {
      throw new Error('Either booking_id or booking_ids must be provided');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const results = [];
    let totalProcessed = 0;
    let totalErrors = 0;

    // Process each booking
    for (const bookingId of targetBookingIds) {
      try {
        logStep('Processing booking invoice', { bookingId, invoice_type });
        
        // Check if invoice already exists
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('*')
          .eq('booking_id', bookingId)
          .single();

        if (existingInvoice && !force_regenerate) {
          logStep('Invoice already exists, skipping', { bookingId });
          results.push({
            booking_id: bookingId,
            success: true,
            skipped: true,
            invoice_id: existingInvoice.id,
            reason: 'Invoice already exists'
          });
          continue;
        }

        // Get booking and related data
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            services (name, base_price),
            booking_services (quantity, base_price, service_name),
            users (first_name, last_name, email, phone)
          `)
          .eq('id', bookingId)
          .single();

        if (bookingError || !booking) {
          throw new Error(`Booking not found: ${bookingError?.message}`);
        }

        // Get completed transaction for this booking
        const { data: transaction } = await supabase
          .from('transactions')
          .select('*')
          .eq('booking_id', bookingId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!transaction && invoice_type === 'enhanced') {
          throw new Error('No completed transaction found for enhanced invoice generation');
        }

        // Calculate invoice totals
        const invoiceData = await calculateInvoiceData(supabase, booking, transaction);
        
        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(supabase);
        
        // Create or update invoice
        let invoice;
        if (existingInvoice && force_regenerate) {
          const { data: updatedInvoice, error: updateError } = await supabase
            .from('invoices')
            .update({
              ...invoiceData,
              invoice_number: existingInvoice.invoice_number, // Keep existing number
              updated_at: new Date().toISOString()
            })
            .eq('id', existingInvoice.id)
            .select()
            .single();

          if (updateError) throw updateError;
          invoice = updatedInvoice;
          logStep('Invoice updated', { invoiceId: invoice.id });
        } else {
          const { data: newInvoice, error: createError } = await supabase
            .from('invoices')
            .insert({
              ...invoiceData,
              booking_id: bookingId,
              invoice_number: invoiceNumber,
              status: 'paid',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (createError) throw createError;
          invoice = newInvoice;
          logStep('Invoice created', { invoiceId: invoice.id });
        }

        // Send email if requested
        let emailSent = false;
        if (send_email && !existingInvoice?.email_sent) {
          try {
            await sendInvoiceEmail(resend, booking, invoice, invoiceData);
            
            // Update email sent flag
            await supabase
              .from('invoices')
              .update({ email_sent: true })
              .eq('id', invoice.id);
              
            emailSent = true;
            logStep('Invoice email sent', { invoiceId: invoice.id });
          } catch (emailError) {
            logStep('Failed to send invoice email', { 
              invoiceId: invoice.id, 
              error: emailError.message 
            });
          }
        }

        results.push({
          booking_id: bookingId,
          success: true,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          email_sent: emailSent,
          total_amount: invoiceData.total_amount
        });

        totalProcessed++;

      } catch (error) {
        logStep('Failed to process booking invoice', { 
          bookingId, 
          error: error.message 
        });
        
        results.push({
          booking_id: bookingId,
          success: false,
          error: error.message
        });
        
        totalErrors++;
      }
    }

    logStep('Invoice generation completed', { 
      totalProcessed, 
      totalErrors, 
      totalBookings: targetBookingIds.length 
    });

    return new Response(JSON.stringify({
      success: totalErrors === 0,
      invoice_type,
      results,
      summary: {
        total_bookings: targetBookingIds.length,
        processed: totalProcessed,
        errors: totalErrors
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error in unified invoice generator', { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function calculateInvoiceData(supabase: any, booking: any, transaction: any) {
  // Calculate subtotal from booking services or base service
  let subtotal = 0;
  
  if (booking.booking_services && booking.booking_services.length > 0) {
    subtotal = booking.booking_services.reduce((sum: number, service: any) => {
      return sum + (service.base_price * service.quantity);
    }, 0);
  } else if (booking.services) {
    subtotal = booking.services.base_price;
  }

  // Get tax rate based on location
  const taxRate = await getTaxRate(supabase, booking);
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  return {
    subtotal_amount: subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    payment_method: transaction?.payment_method || 'card',
    captured_amount: transaction?.amount || totalAmount
  };
}

async function getTaxRate(supabase: any, booking: any): Promise<number> {
  const customerInfo = booking.guest_customer_info || {};
  const state = customerInfo.state || 'TX'; // Default to Texas
  
  const { data: taxData } = await supabase
    .from('state_tax_rates')
    .select('tax_rate')
    .eq('state_code', state)
    .eq('is_active', true)
    .single();
    
  return taxData?.tax_rate || 8.25; // Default TX rate
}

async function generateInvoiceNumber(supabase: any): Promise<string> {
  const year = new Date().getFullYear();
  const yearSuffix = year.toString().slice(-2);
  
  const { data, error } = await supabase.rpc('generate_invoice_number');
  
  if (error || !data) {
    // Fallback to timestamp-based number
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${yearSuffix}-${timestamp}`;
  }
  
  return data;
}

async function sendInvoiceEmail(resend: any, booking: any, invoice: any, invoiceData: any) {
  const customerEmail = booking.guest_customer_info?.email || booking.users?.email;
  const customerName = booking.guest_customer_info?.name || 
                      `${booking.users?.first_name || ''} ${booking.users?.last_name || ''}`.trim();

  if (!customerEmail) {
    throw new Error('No customer email found');
  }

  const emailHtml = `
    <h1>Invoice for Your TV Mounting Service</h1>
    <p>Dear ${customerName},</p>
    <p>Thank you for choosing Hero TV Mounting! Please find your service invoice below:</p>
    
    <div style="border: 1px solid #ccc; padding: 20px; margin: 20px 0;">
      <h2>Invoice #${invoice.invoice_number}</h2>
      <p><strong>Service Date:</strong> ${booking.scheduled_date}</p>
      <p><strong>Subtotal:</strong> $${invoiceData.subtotal_amount.toFixed(2)}</p>
      <p><strong>Tax:</strong> $${invoiceData.tax_amount.toFixed(2)}</p>
      <p><strong>Total:</strong> $${invoiceData.total_amount.toFixed(2)}</p>
      <p><strong>Status:</strong> Paid</p>
    </div>
    
    <p>If you have any questions about this invoice, please contact us.</p>
    <p>Thank you for your business!</p>
    <p>Hero TV Mounting Team</p>
  `;

  await resend.emails.send({
    from: 'Hero TV Mounting <invoices@herotv.com>',
    to: [customerEmail],
    subject: `Invoice #${invoice.invoice_number} - Hero TV Mounting Service`,
    html: emailHtml,
  });
}