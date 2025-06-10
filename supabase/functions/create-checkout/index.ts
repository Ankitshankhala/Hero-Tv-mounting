
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
      return new Response(
        JSON.stringify({ error: bookingError?.message || 'Failed to create booking' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Hero TV Mounting Service',
              description: `Service Date: ${new Date(bookingData.scheduledAt).toLocaleDateString()}`
            },
            unit_amount: Math.round(bookingData.totalPrice * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/`,
      metadata: {
        booking_id: booking.id,
        customer_name: customerName,
        customer_email: customerEmail,
      },
    });

    // Create payment session record
    await supabaseClient.from('payment_sessions').insert({
      booking_id: booking.id,
      stripe_session_id: session.id,
      amount: Math.round(bookingData.totalPrice * 100),
      currency: 'usd',
      status: 'pending',
    });

    return new Response(
      JSON.stringify({ 
        url: session.url,
        booking_id: booking.id,
        session_id: session.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
