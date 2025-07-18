import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, customerId, paymentMethodId } = await req.json();

    console.log('Processing payment for booking:', bookingId);

    // Initialize Supabase client with service role
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseServiceRole
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Verify customer owns the booking
    if (booking.customer_id !== customerId) {
      throw new Error('Unauthorized access to booking');
    }

    // Check if booking is already paid or cancelled
    if (booking.status === 'cancelled') {
      throw new Error('Cannot process payment for cancelled booking');
    }

    if (booking.payment_status === 'completed') {
      throw new Error('Booking is already paid');
    }

    // Get service details for amount
    const { data: service, error: serviceError } = await supabaseServiceRole
      .from('services')
      .select('base_price')
      .eq('id', booking.service_id)
      .single();

    if (serviceError || !service) {
      throw new Error('Service not found');
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(service.base_price * 100), // Convert to cents
      currency: 'usd',
      customer: booking.stripe_customer_id,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${req.headers.get('origin')}/booking-success`,
      metadata: {
        booking_id: bookingId,
      },
    });

    console.log('Payment intent status:', paymentIntent.status);

    if (paymentIntent.status === 'succeeded') {
      // Payment successful - update booking and create transaction
      const { error: updateError } = await supabaseServiceRole
        .from('bookings')
        .update({
          payment_status: 'completed',
          status: 'confirmed',
          payment_intent_id: paymentIntent.id,
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking:', updateError);
        throw updateError;
      }

      // Create successful transaction record
      const { error: transactionError } = await supabaseServiceRole
        .from('transactions')
        .insert({
          booking_id: bookingId,
          amount: service.base_price,
          status: 'completed',
          payment_intent_id: paymentIntent.id,
          payment_method: 'card',
          transaction_type: 'charge',
        });

      if (transactionError) {
        console.error('Failed to create transaction:', transactionError);
      }

      // Trigger worker assignment
      const { error: assignmentError } = await supabaseServiceRole
        .rpc('auto_assign_workers_with_coverage', { p_booking_id: bookingId });

      if (assignmentError) {
        console.error('Failed to assign workers:', assignmentError);
      }

      return new Response(JSON.stringify({
        success: true,
        transaction_id: paymentIntent.id,
        booking_id: bookingId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (paymentIntent.status === 'requires_action') {
      return new Response(JSON.stringify({
        success: false,
        requires_action: true,
        client_secret: paymentIntent.client_secret,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      // Payment failed
      const { error: transactionError } = await supabaseServiceRole
        .from('transactions')
        .insert({
          booking_id: bookingId,
          amount: service.base_price,
          status: 'failed',
          payment_intent_id: paymentIntent.id,
          payment_method: 'card',
          transaction_type: 'charge',
        });

      if (transactionError) {
        console.error('Failed to create failed transaction:', transactionError);
      }

      throw new Error('Payment failed');
    }

  } catch (error) {
    console.error('Error processing payment:', error);
    
    // Handle specific Stripe errors
    let errorMessage = 'Payment processing failed';
    if (error.type === 'StripeCardError') {
      errorMessage = error.message;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Invalid payment information';
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