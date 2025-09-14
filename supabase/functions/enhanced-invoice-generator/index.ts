import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { booking_id, transaction_id, trigger_source, send_email } = await req.json();
    console.log('Invoice generator triggered:', { booking_id, transaction_id, trigger_source, send_email });

    // Get booking details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (error || !booking) {
      console.error('Booking not found:', error);
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if invoice already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('booking_id', booking_id)
      .single();

    if (existingInvoice) {
      console.log('Invoice already exists for booking:', booking_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Invoice already exists',
          invoice_id: existingInvoice.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invoice number
    const invoice_number = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        booking_id,
        invoice_number,
        amount: booking.total_amount || 0,
        status: 'paid',
        issued_at: new Date().toISOString()
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Failed to create invoice:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invoice' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Invoice created successfully:', invoice.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Invoice generator error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});