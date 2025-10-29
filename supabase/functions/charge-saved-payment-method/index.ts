import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@17.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('Stripe secret key not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-12-18.acacia',
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { bookingId, amount, notes } = await req.json();

    console.log('Charging saved payment method:', {
      bookingId,
      amount
    });

    // Get booking with customer info
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*, customer:users!customer_id(email, name)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
      throw new Error('No saved payment method found for this booking');
    }

    console.log('Creating payment intent for saved method');

    // Create a PaymentIntent with the saved payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: booking.stripe_customer_id,
      payment_method: booking.stripe_payment_method_id,
      off_session: true, // Charging when customer is not present
      confirm: true, // Automatically confirm the payment
      description: `Payment for booking ${bookingId}`,
      metadata: {
        booking_id: bookingId,
        type: 'saved_payment_method_charge'
      }
    });

    console.log('Payment intent created:', paymentIntent.id, 'status:', paymentIntent.status);

    // Create transaction record
    const { error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        booking_id: bookingId,
        amount: amount,
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
        payment_intent_id: paymentIntent.id,
        transaction_type: 'payment',
        notes: notes || 'Charged saved payment method'
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
    }

    // Update booking status
    const updateData: any = {
      payment_status: paymentIntent.status === 'succeeded' ? 'paid' : 'pending',
      updated_at: new Date().toISOString(),
    };

    if (paymentIntent.status === 'succeeded') {
      updateData.status = 'completed';
      updateData.pending_payment_amount = 0;
    }

    await supabaseClient
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    console.log('Booking updated with payment status');

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        amount: amount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error charging saved payment method:', error);
    
    // Handle specific Stripe errors
    let errorMessage = 'Failed to charge payment method';
    if (error.type === 'StripeCardError') {
      errorMessage = 'Card was declined. Please update payment method.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
