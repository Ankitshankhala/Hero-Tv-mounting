
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

    const { booking_id, amount, description, customer_email } = await req.json();
    
    console.log('Payment link request params:', { booking_id, amount, description, customer_email });

    if (!booking_id || !amount) {
      return new Response(
        JSON.stringify({ error: 'Booking ID and amount are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*, customer:users!customer_id(name, email)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: bookingError?.message || 'Booking not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // CRITICAL FIX: Convert amount to cents if it's in dollars
    const amountInCents = typeof amount === 'number' && amount < 1000 
      ? Math.round(amount * 100) // Convert dollars to cents
      : amount; // Assume already in cents if > 1000
    
    console.log('Amount conversion:', { originalAmount: amount, amountInCents });

    // Create payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: description || `Service Payment - Booking #${booking_id.slice(0, 8)}`,
            },
            unit_amount: amountInCents, // Properly converted to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_id: booking_id,
        customer_email: customer_email || booking.customer?.email || '',
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${req.headers.get('origin') || 'https://hero-tv-mounting.com'}/payment-success?booking_id=${booking_id}`,
        },
      },
    });

    // Record the payment session
    const { error: sessionError } = await supabaseClient.from('payment_sessions').insert({
      session_id: paymentLink.id,
      user_id: booking.customer_id || booking_id, // Use customer_id or booking_id as fallback
      transaction_id: booking_id, // Use booking_id as transaction reference
      status: 'created',
    });
    
    if (sessionError) {
      console.error('Failed to record payment session:', sessionError);
    }

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
