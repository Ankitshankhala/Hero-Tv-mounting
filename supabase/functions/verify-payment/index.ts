
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

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    });

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get payment session from database
    const { data: paymentSession, error: sessionError } = await supabaseClient
      .from('payment_sessions')
      .select('*, bookings(*)')
      .eq('stripe_session_id', session_id)
      .single();

    if (sessionError || !paymentSession) {
      return new Response(
        JSON.stringify({ error: 'Payment session not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verify payment with Stripe
    const stripeSession = await stripe.checkout.sessions.retrieve(session_id);

    if (stripeSession.payment_status === 'paid') {
      // Update payment session status
      await supabaseClient
        .from('payment_sessions')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('stripe_session_id', session_id);

      // Update booking status to confirmed
      await supabaseClient
        .from('bookings')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', paymentSession.booking_id);

      // Create transaction record
      await supabaseClient.from('transactions').insert({
        booking_id: paymentSession.booking_id,
        stripe_payment_id: stripeSession.payment_intent as string,
        amount: paymentSession.amount / 100, // Convert back to dollars
        status: 'success',
        payment_method: 'card',
        processed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          booking: paymentSession.bookings,
          payment_status: 'paid'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Update payment session status based on Stripe status
      const status = stripeSession.payment_status === 'unpaid' ? 'failed' : 'pending';
      await supabaseClient
        .from('payment_sessions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('stripe_session_id', session_id);

      return new Response(
        JSON.stringify({
          success: false,
          payment_status: stripeSession.payment_status,
          booking: paymentSession.bookings
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
