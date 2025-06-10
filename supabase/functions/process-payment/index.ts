
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.18.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    });

    const { bookingId, customerId, paymentMethodId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'Booking ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, total_price, customer_id, status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: bookingError?.message || 'Booking not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verify customer owns this booking
    if (booking.customer_id !== customerId) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to process this booking' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Don't process if already paid or cancelled
    if (booking.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'Cannot process payment for cancelled booking' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if payment already exists
    const { data: existingPayment } = await supabaseClient
      .from('transactions')
      .select('id, status')
      .eq('booking_id', bookingId)
      .eq('status', 'success')
      .maybeSingle();

    if (existingPayment?.status === 'success') {
      return new Response(
        JSON.stringify({ error: 'Payment already processed', transaction_id: existingPayment.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // Process payment with Stripe
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(booking.total_price * 100), // Convert to cents
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        description: `Booking #${booking.id}`,
        metadata: {
          booking_id: booking.id,
        },
      });
    } catch (stripeError) {
      // Log failed payment attempt
      await supabaseClient.from('transactions').insert({
        booking_id: bookingId,
        amount: booking.total_price,
        status: 'failed',
        payment_method: 'card',
        processed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ error: 'Payment processing failed', stripe_error: stripeError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Record successful transaction
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        booking_id: bookingId,
        stripe_payment_id: paymentIntent.id,
        amount: booking.total_price,
        status: 'success',
        payment_method: 'card',
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (transactionError) {
      return new Response(
        JSON.stringify({ error: 'Failed to record transaction', db_error: transactionError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Update booking status if not already confirmed
    if (booking.status === 'pending') {
      await supabaseClient
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction_id: transaction.id,
        payment_intent: paymentIntent.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
