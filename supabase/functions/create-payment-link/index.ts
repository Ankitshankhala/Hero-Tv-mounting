
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

    const { bookingId, amount, description, customerEmail } = await req.json();

    if (!bookingId || !amount) {
      return new Response(
        JSON.stringify({ error: 'Booking ID and amount are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*, customer:users!customer_id(name, email)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: bookingError?.message || 'Booking not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Create payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: description || `Service Payment - Booking #${bookingId.slice(0, 8)}`,
            },
            unit_amount: amount, // Already in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_id: bookingId,
        customer_email: customerEmail || booking.customer?.email || '',
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${req.headers.get('origin') || 'https://hero-tv-mounting.com'}/payment-success?booking_id=${bookingId}`,
        },
      },
    });

    // Record the payment session
    await supabaseClient.from('payment_sessions').insert({
      booking_id: bookingId,
      stripe_session_id: paymentLink.id,
      amount: Math.round(amount / 100), // Convert back to dollars for storage
      currency: 'usd',
      status: 'pending',
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        url: paymentLink.url,
        payment_link_id: paymentLink.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Payment link creation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
