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
  console.log(`[CANCEL-BOOKING-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id, payment_intent_id, reason = 'payment_failed' } = await req.json();
    
    logStep("Function started", { booking_id, payment_intent_id, reason });

    // Input validation
    if (!booking_id || typeof booking_id !== 'string') {
      throw new Error('booking_id is required and must be a string');
    }

    // Initialize Supabase client with service role for database operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Cancel Stripe payment intent if provided
    if (payment_intent_id) {
      try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
          apiVersion: '2023-10-16',
        });
        
        logStep("Cancelling Stripe payment intent", { payment_intent_id });
        await stripe.paymentIntents.cancel(payment_intent_id);
        logStep("Stripe payment intent cancelled successfully");
      } catch (stripeError) {
        logStep("Failed to cancel Stripe payment intent", { error: stripeError });
        // Continue with booking cleanup even if Stripe cancellation fails
      }
    }

    // Update booking status to cancelled/failed
    logStep("Updating booking status", { booking_id, reason });
    const { error: bookingError } = await supabaseServiceRole
      .from('bookings')
      .update({ 
        status: 'cancelled',
        payment_status: 'failed'
      })
      .eq('id', booking_id);

    if (bookingError) {
      logStep("Failed to update booking", { error: bookingError });
      throw new Error(`Failed to update booking: ${bookingError.message}`);
    }

    // Update transaction status if payment intent exists
    if (payment_intent_id) {
      logStep("Updating transaction status to failed", { payment_intent_id });
      const { error: transactionError } = await supabaseServiceRole
        .from('transactions')
        .update({ 
          status: 'failed',
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString()
        })
        .eq('payment_intent_id', payment_intent_id);

      if (transactionError) {
        logStep("Failed to update transaction", { error: transactionError });
        // Log but don't throw - booking cancellation is primary goal
      }
    }

    const response = {
      success: true,
      booking_id: booking_id,
      status: 'cancelled',
      reason: reason
    };

    logStep("Booking cancellation completed successfully", response);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cancel-booking-payment", { error: errorMessage });
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (errorMessage.includes('required')) {
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