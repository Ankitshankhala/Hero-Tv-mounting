import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { booking_id, send_email = true } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log(`[UPDATE-INVOICE] Updating invoice for booking: ${booking_id}`);

    // Get existing invoice
    const { data: existingInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('booking_id', booking_id)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch invoice: ${fetchError.message}`);
    }

    if (!existingInvoice) {
      // No existing invoice, generate a new one
      console.log(`[UPDATE-INVOICE] No existing invoice, generating new one`);
      
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { booking_id, send_email }
      });

      if (error) throw error;
      
      return new Response(JSON.stringify({
        success: true,
        message: 'New invoice generated',
        invoice: data?.invoice
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Recalculate invoice amounts from booking services
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        booking_services(id, service_name, base_price, quantity, configuration)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError) {
      throw new Error(`Failed to fetch booking: ${bookingError.message}`);
    }

    // Calculate new totals
    let subtotal = 0;
    if (booking.booking_services && booking.booking_services.length > 0) {
      for (const bs of booking.booking_services) {
        subtotal += bs.base_price * bs.quantity;
      }
    }

    const taxAmount = subtotal * (existingInvoice.tax_rate || 0);
    const totalAmount = subtotal + taxAmount;

    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        amount: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingInvoice.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`);
    }

    // Update invoice items
    await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', existingInvoice.id);

    if (booking.booking_services && booking.booking_services.length > 0) {
      const invoiceItems = booking.booking_services.map((bs: any) => ({
        invoice_id: existingInvoice.id,
        service_name: bs.service_name,
        description: bs.configuration ? JSON.stringify(bs.configuration) : null,
        quantity: bs.quantity,
        unit_price: bs.base_price,
        total_price: bs.base_price * bs.quantity
      }));

      await supabase.from('invoice_items').insert(invoiceItems);
    }

    // Send updated invoice email if requested
    if (send_email) {
      console.log(`[UPDATE-INVOICE] Sending updated invoice email`);
      
      try {
        await supabase.functions.invoke('send-invoice-email', {
          body: { invoice_id: existingInvoice.id }
        });
      } catch (emailError) {
        console.error('[UPDATE-INVOICE] Email send failed:', emailError);
      }
    }

    console.log(`[UPDATE-INVOICE] Invoice updated successfully: ${existingInvoice.invoice_number}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[UPDATE-INVOICE] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
