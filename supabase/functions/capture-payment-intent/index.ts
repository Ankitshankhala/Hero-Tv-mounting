import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const { booking_id, payment_intent_id } = await req.json();

    console.log('[CAPTURE-PAYMENT] Starting capture for:', { booking_id, payment_intent_id });

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, transactions(*)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('[CAPTURE-PAYMENT] Booking not found:', bookingError);
      throw new Error('Booking not found');
    }

    console.log('[CAPTURE-PAYMENT] Booking details:', {
      id: booking.id,
      status: booking.status,
      payment_status: booking.payment_status,
      payment_intent_id: booking.payment_intent_id
    });

    // Validate booking is ready for capture
    if (booking.status !== 'completed') {
      throw new Error(`Cannot capture payment for booking with status: ${booking.status}. Job must be completed first.`);
    }

    if (booking.payment_status !== 'authorized') {
      throw new Error(`Cannot capture payment with status: ${booking.payment_status}. Payment must be authorized.`);
    }

    const intentId = payment_intent_id || booking.payment_intent_id;
    if (!intentId) {
      throw new Error('No payment intent ID found');
    }

    // Capture the payment through Stripe
    console.log('[CAPTURE-PAYMENT] Capturing Stripe PaymentIntent:', intentId);
    const paymentIntent = await stripe.paymentIntents.capture(intentId);

    if (paymentIntent.status !== 'succeeded') {
      console.error('[CAPTURE-PAYMENT] Capture failed:', paymentIntent.status);
      throw new Error(`Payment capture failed with status: ${paymentIntent.status}`);
    }

    const capturedAmount = paymentIntent.amount / 100; // Convert from cents
    console.log('[CAPTURE-PAYMENT] Successfully captured:', capturedAmount);

    // Create capture transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        booking_id: booking.id,
        amount: capturedAmount,
        status: 'completed',
        payment_intent_id: intentId,
        transaction_type: 'capture',
        payment_method: 'card',
        captured_at: new Date().toISOString()
      })
      .select()
      .single();

    if (transactionError) {
      console.error('[CAPTURE-PAYMENT] Transaction record error:', transactionError);
      throw new Error('Failed to create transaction record');
    }

    // Update booking payment_status to 'captured' (do NOT change booking.status)
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        payment_status: 'captured'
        // Explicitly NOT updating booking.status - it should already be 'completed'
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('[CAPTURE-PAYMENT] Booking update error:', updateError);
      throw new Error('Failed to update booking payment status');
    }

    console.log('[CAPTURE-PAYMENT] Payment captured successfully');

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        amount_captured: capturedAmount,
        payment_intent_id: intentId,
        message: 'Payment captured successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CAPTURE-PAYMENT] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Payment capture failed'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
