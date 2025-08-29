import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT-INTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { payment_intent_id, booking_id } = await req.json();

    if (!payment_intent_id && !booking_id) {
      logStep("Missing required parameters");
      return new Response(
        JSON.stringify({ error: 'payment_intent_id or booking_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let paymentIntentId = payment_intent_id;

    // If only booking_id provided, get payment_intent_id from booking
    if (!paymentIntentId && booking_id) {
      const { data: booking } = await supabaseClient
        .from('bookings')
        .select('payment_intent_id')
        .eq('id', booking_id)
        .single();

      if (booking?.payment_intent_id) {
        paymentIntentId = booking.payment_intent_id;
        logStep("Retrieved payment_intent_id from booking", { payment_intent_id: paymentIntentId });
      } else {
        return new Response(
          JSON.stringify({ error: 'No payment intent found for booking' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    logStep("Retrieving payment intent from Stripe", { payment_intent_id: paymentIntentId });

    // Get payment intent from Stripe as source of truth
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    logStep("Stripe payment intent retrieved", { 
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    });

    // Find our transaction record
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .select('id, status, booking_id')
      .eq('payment_intent_id', paymentIntentId)
      .single();

    if (transactionError || !transaction) {
      logStep("Transaction not found in database", { error: transactionError?.message });
      return new Response(
        JSON.stringify({ 
          error: 'Transaction not found',
          stripe_status: paymentIntent.status,
          payment_intent_id: paymentIntentId
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if statuses are already in sync
    const stripeStatus = paymentIntent.status;
    const dbStatus = transaction.status;
    
    logStep("Comparing statuses", { stripe_status: stripeStatus, db_status: dbStatus });

    // Determine if sync is needed
    let needsSync = false;
    let targetStatus: string;

    switch (stripeStatus) {
      case 'requires_capture':
        targetStatus = 'authorized';
        needsSync = dbStatus !== 'authorized';
        break;
      case 'succeeded':
        targetStatus = 'completed';
        needsSync = dbStatus !== 'completed';
        break;
      case 'canceled':
      case 'failed':
        targetStatus = 'failed';
        needsSync = dbStatus !== 'failed';
        break;
      case 'processing':
      case 'requires_action':
      case 'requires_payment_method':
        targetStatus = 'pending';
        needsSync = dbStatus !== 'pending';
        break;
      default:
        targetStatus = dbStatus; // Keep current status if unknown
        needsSync = false;
    }

    if (needsSync) {
      logStep("Status sync needed", { 
        stripe_status: stripeStatus, 
        current_db_status: dbStatus, 
        target_status: targetStatus 
      });

      // Call our unified sync function to fix the status
      const { data: syncResult, error: syncError } = await supabaseClient.functions.invoke(
        'unified-payment-status-sync',
        {
          body: {
            payment_intent_id: paymentIntentId,
            booking_id: transaction.booking_id
          }
        }
      );

      if (syncError) {
        logStep("Status sync failed", { error: syncError.message });
        return new Response(
          JSON.stringify({ 
            error: 'Status sync failed',
            stripe_status: stripeStatus,
            db_status: dbStatus,
            sync_error: syncError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      logStep("Status sync completed", { sync_result: syncResult });
    } else {
      logStep("Statuses already in sync", { status: dbStatus });
    }

    // Return verification result
    const isSuccessful = ['requires_capture', 'succeeded'].includes(stripeStatus);
    const requiresCapture = stripeStatus === 'requires_capture';

    return new Response(
      JSON.stringify({
        success: isSuccessful,
        status: stripeStatus,
        db_status: targetStatus,
        requires_capture: requiresCapture,
        amount: paymentIntent.amount / 100, // Convert cents to dollars
        currency: paymentIntent.currency,
        transaction_id: transaction.id,
        booking_id: transaction.booking_id,
        synced: needsSync ? 'fixed' : 'already_synced'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logStep("ERROR in verify-payment-intent", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});