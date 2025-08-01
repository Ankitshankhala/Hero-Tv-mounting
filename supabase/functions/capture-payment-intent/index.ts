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
    const { booking_id: bookingId } = await req.json();

    console.log('=== CAPTURE PAYMENT DEBUG ===');
    console.log('Capturing payment for booking:', bookingId);

    if (!bookingId) {
      console.error('No booking ID provided');
      throw new Error('Booking ID is required');
    }

    // Initialize Supabase client with service role
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('Fetching booking details...');
    // Get booking details
    const { data: booking, error: bookingError } = await supabaseServiceRole
      .from('bookings')
      .select('payment_intent_id, payment_status, status')
      .eq('id', bookingId)
      .maybeSingle();

    console.log('Booking query result:', { booking, bookingError });

    if (bookingError) {
      console.error('Booking error:', bookingError);
      throw new Error(`Failed to fetch booking: ${bookingError.message}`);
    }
    
    if (!booking) {
      console.error('No booking found for ID:', bookingId);
      throw new Error('Booking not found');
    }

    console.log('Booking details:', { 
      payment_intent_id: booking.payment_intent_id, 
      payment_status: booking.payment_status 
    });

    if (!booking.payment_intent_id) {
      console.error('No payment intent found for booking');
      throw new Error('No payment intent found for this booking');
    }

    // Initialize Stripe
    console.log('Initializing Stripe...');
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('No Stripe secret key found');
      throw new Error('Stripe secret key not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    console.log('Checking PaymentIntent status before capture:', booking.payment_intent_id);
    
    // First, retrieve the current PaymentIntent to check its status
    const currentPaymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
    
    console.log('Current PaymentIntent status:', {
      id: currentPaymentIntent.id,
      status: currentPaymentIntent.status,
      amount: currentPaymentIntent.amount
    });

    let paymentIntent;
    
    // Check if already captured/succeeded
    if (currentPaymentIntent.status === 'succeeded') {
      console.log('PaymentIntent already succeeded - no capture needed');
      paymentIntent = currentPaymentIntent;
    } else if (currentPaymentIntent.status === 'requires_capture') {
      console.log('Attempting to capture payment intent:', booking.payment_intent_id);
      // Capture the payment intent
      paymentIntent = await stripe.paymentIntents.capture(booking.payment_intent_id);
    } else {
      console.log('PaymentIntent cannot be captured with status:', currentPaymentIntent.status);
      throw new Error(`Payment cannot be captured. Current status: ${currentPaymentIntent.status}`);
    }

    console.log('Payment capture result:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    });

    // Map Stripe status to internal status
    const statusMapping = mapStripeStatus(paymentIntent.status, 'charge');
    console.log('Status mapping:', statusMapping);

    if (paymentIntent.status === 'succeeded') {
      console.log('Payment succeeded, updating booking status...');
      console.log('Current booking status:', booking.status, 'payment_status:', booking.payment_status);
      
      // Update booking to completed status and captured payment status
      console.log('Updating booking to completed status...');
      const { error: updateError } = await supabaseServiceRole
        .from('bookings')
        .update({
          payment_status: 'completed',
          status: 'completed',
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking:', updateError);
        throw updateError;
      }
      console.log('Booking status updated to completed successfully');

      console.log('Booking updated successfully, updating transaction...');

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

      console.log('Creating capture transaction record...');

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

      console.log('Payment capture completed successfully');

      return new Response(JSON.stringify({
        success: true,
        payment_status: 'completed',
        booking_status: 'completed',
        booking_id: bookingId,
        message: 'Payment captured and job marked as completed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      console.log('Payment capture failed with status:', paymentIntent.status);
      
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
    console.error('=== CAPTURE PAYMENT ERROR ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      type: error.type,
      code: error.code
    });
    
    // Handle specific Stripe errors
    let errorMessage = 'Payment capture failed';
    if (error.type && error.type.includes('Stripe')) {
      errorMessage = error.message;
    } else if (error.message) {
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