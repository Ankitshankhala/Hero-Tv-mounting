
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.18.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
    
    if (!stripeSecretKey) {
      console.error('Stripe secret key not found');
      return new Response(
        JSON.stringify({ error: 'Stripe configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const { bookingData, customerEmail, customerName } = await req.json();

    if (!bookingData) {
      return new Response(
        JSON.stringify({ error: 'Booking data is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create booking first
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .insert({
        customer_address: bookingData.address,
        scheduled_at: bookingData.scheduledAt,
        services: bookingData.services,
        total_price: bookingData.totalPrice,
        total_duration_minutes: bookingData.totalDuration,
        special_instructions: bookingData.specialInstructions,
        customer_latitude: bookingData.latitude,
        customer_longitude: bookingData.longitude,
        customer_zipcode: bookingData.zipcode,
        status: 'pending'
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error('Booking creation error:', bookingError);
      return new Response(
        JSON.stringify({ error: bookingError?.message || 'Failed to create booking' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create Payment Intent instead of checkout session
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(bookingData.totalPrice * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        booking_id: booking.id,
        customer_name: customerName,
        customer_email: customerEmail,
      },
      description: `Hero TV Mounting Service - ${new Date(bookingData.scheduledAt).toLocaleDateString()}`,
    });

    // Create payment session record
    await supabaseClient.from('payment_sessions').insert({
      booking_id: booking.id,
      stripe_session_id: paymentIntent.id,
      amount: Math.round(bookingData.totalPrice * 100),
      currency: 'usd',
      status: 'pending',
    });

    return new Response(
      JSON.stringify({ 
        client_secret: paymentIntent.client_secret,
        booking_id: booking.id,
        payment_intent_id: paymentIntent.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Payment intent creation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
