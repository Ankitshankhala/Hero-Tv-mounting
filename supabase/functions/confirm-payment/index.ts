import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_intent_id, booking_id } = await req.json();
    
    logStep("Function started", { payment_intent_id, booking_id });

    // Input validation
    if (!payment_intent_id || typeof payment_intent_id !== 'string') {
      throw new Error('payment_intent_id is required and must be a string');
    }

    if (!booking_id || typeof booking_id !== 'string') {
      throw new Error('booking_id is required and must be a string');
    }

    // Initialize Supabase client with service role for database operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Verify payment intent status with Stripe
    logStep("Retrieving payment intent from Stripe", { payment_intent_id });
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    
    if (paymentIntent.status !== 'succeeded') {
      logStep("Payment intent not succeeded", { status: paymentIntent.status });
      throw new Error(`Payment not completed. Status: ${paymentIntent.status}`);
    }

    logStep("Payment intent verified as succeeded", { amount: paymentIntent.amount });

    // Update booking status to confirmed
    logStep("Updating booking status to confirmed", { booking_id });
    const { error: bookingError } = await supabaseServiceRole
      .from('bookings')
      .update({ 
        status: 'confirmed',
        payment_status: 'authorized',
        payment_intent_id: payment_intent_id
      })
      .eq('id', booking_id);

    if (bookingError) {
      logStep("Failed to update booking", { error: bookingError });
      throw new Error(`Failed to update booking: ${bookingError.message}`);
    }

    // Update transaction status to authorized
    logStep("Updating transaction status to authorized", { payment_intent_id });
    const { error: transactionError } = await supabaseServiceRole
      .from('transactions')
      .update({ 
        status: 'authorized',
        booking_id: booking_id
      })
      .eq('payment_intent_id', payment_intent_id);

    if (transactionError) {
      logStep("Failed to update transaction", { error: transactionError });
      // Don't throw here as booking is already confirmed
      // Just log the error for manual review
    }

    const response = {
      success: true,
      booking_id: booking_id,
      payment_intent_id: payment_intent_id,
      status: 'confirmed'
    };

    logStep("Payment confirmation completed successfully", response);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in confirm-payment", { error: errorMessage });
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (errorMessage.includes('required') || 
        errorMessage.includes('Payment not completed')) {
      statusCode = 400;
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    });
  }
});