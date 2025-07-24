import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mapStripeStatus } from "../shared/status-mapping.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

    console.log('Capturing payment for booking:', bookingId);

    // Initialize Supabase client with service role
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseServiceRole
      .from('bookings')
      .select('payment_intent_id, payment_status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    if (!booking.payment_intent_id) {
      throw new Error('No payment intent found for this booking');
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Capture the payment intent
    const paymentIntent = await stripe.paymentIntents.capture(
      booking.payment_intent_id
    );

    console.log('Payment capture result:', paymentIntent.status);

    // Map Stripe status to internal status
    const statusMapping = mapStripeStatus(paymentIntent.status, 'charge');
    console.log('Status mapping:', statusMapping);

    if (paymentIntent.status === 'succeeded') {
      // Update booking status using mapped statuses
      const { error: updateError } = await supabaseServiceRole
        .from('bookings')
        .update({
          payment_status: statusMapping.payment_status,
          status: statusMapping.booking_status,
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking:', updateError);
        throw updateError;
      }

      // Update transaction record with proper status and create a capture transaction
      const { error: transactionError } = await supabaseServiceRole
        .from('transactions')
        .update({
          status: statusMapping.internal_status,
        })
        .eq('payment_intent_id', booking.payment_intent_id);

      if (transactionError) {
        console.error('Failed to update transaction:', transactionError);
      }

      // Create a separate capture transaction record
      const { error: captureTransactionError } = await supabaseServiceRole
        .from('transactions')
        .insert({
          booking_id: bookingId,
          amount: paymentIntent.amount / 100, // Convert from cents
          status: statusMapping.internal_status,
          payment_intent_id: booking.payment_intent_id,
          payment_method: 'card',
          transaction_type: 'capture',
          currency: paymentIntent.currency.toUpperCase(),
        });

      if (captureTransactionError) {
        console.error('Failed to create capture transaction:', captureTransactionError);
      }

      return new Response(JSON.stringify({
        success: true,
        payment_status: 'captured',
        booking_id: bookingId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      // Capture failed
      const { error: updateError } = await supabaseServiceRole
        .from('bookings')
        .update({
          payment_status: 'capture_failed',
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking status:', updateError);
      }

      throw new Error(`Payment capture failed: ${paymentIntent.status}`);
    }

  } catch (error) {
    console.error('Error capturing payment:', error);
    
    // Handle specific Stripe errors
    let errorMessage = 'Payment capture failed';
    if (error.type && error.type.includes('Stripe')) {
      errorMessage = error.message;
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});