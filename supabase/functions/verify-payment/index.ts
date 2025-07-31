
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting payment verification');
    
    const { session_id } = await req.json();
    
    if (!session_id) {
      throw new Error('Session ID is required');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep('Retrieving checkout session', { session_id });
    
    // Get the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent']
    });

    if (!session) {
      throw new Error('Session not found');
    }

    logStep('Session retrieved', { 
      paymentStatus: session.payment_status,
      paymentIntentId: session.payment_intent?.id || session.payment_intent
    });

    // Find the booking associated with this payment
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(name, email, phone),
        worker:users!bookings_worker_id_fkey(name, email, phone),
        service:services(name, description, base_price),
        booking_services(*)
      `)
      .eq('payment_intent_id', session.payment_intent?.id || session.payment_intent)
      .single();

    if (bookingError || !booking) {
      logStep('Booking not found', { error: bookingError });
      throw new Error('Booking not found for this payment');
    }

    logStep('Booking found', { bookingId: booking.id, status: booking.status });

    // Update booking status based on payment status
    if (session.payment_status === 'paid') {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'payment_authorized',
          payment_status: 'authorized'
        })
        .eq('id', booking.id);

      if (updateError) {
        logStep('Failed to update booking status', { error: updateError });
      } else {
        logStep('Booking status updated to payment_authorized');
        booking.status = 'payment_authorized';
        booking.payment_status = 'authorized';
      }

      // Update or create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .upsert({
          booking_id: booking.id,
          payment_intent_id: session.payment_intent?.id || session.payment_intent,
          amount: session.amount_total ? session.amount_total / 100 : booking.total_amount || 0,
          status: 'authorized',
          transaction_type: 'charge',
          payment_method: 'card',
          currency: 'USD'
        }, {
          onConflict: 'payment_intent_id'
        });

      if (transactionError) {
        logStep('Failed to update transaction', { error: transactionError });
      } else {
        logStep('Transaction updated successfully');
      }
    }

    return new Response(JSON.stringify({
      success: true,
      booking: booking,
      payment_status: session.payment_status,
      session_status: session.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error verifying payment', { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
