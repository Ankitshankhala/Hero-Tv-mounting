import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-SERVICE-ADDITION-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_intent_id, booking_id } = await req.json();

    if (!payment_intent_id || !booking_id) {
      return new Response(
        JSON.stringify({ error: 'payment_intent_id and booking_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep('Processing service addition payment confirmation', { 
      payment_intent_id, 
      booking_id 
    });

    // Update transaction status to completed (works for both automatic and manual capture)
    const { error: transactionError } = await supabase
      .from('transactions')
      .update({ 
        status: 'completed',
        captured_at: new Date().toISOString()
      })
      .eq('payment_intent_id', payment_intent_id)
      .eq('booking_id', booking_id);

    if (transactionError) {
      logStep('Error updating transaction', { error: transactionError.message });
      throw new Error(`Failed to update transaction: ${transactionError.message}`);
    }

    // Update booking to clear pending payment amount, modifications flag, and mark as completed
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ 
        pending_payment_amount: null,
        has_modifications: false,
        status: 'completed'
      })
      .eq('id', booking_id);

    if (bookingError) {
      logStep('Error updating booking', { error: bookingError.message });
      throw new Error(`Failed to update booking: ${bookingError.message}`);
    }

    logStep('Service addition payment processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Service addition payment processed successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { error: message });
    
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});