import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mapStripeStatus } from "../shared/status-mapping.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-INTENT] ${step}${detailsStr}`);
};

// Utility function to validate UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

serve(async (req) => {
  const startTime = performance.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    logStep("Received request body", body);
    const {
      amount,
      currency,
      idempotency_key,
      user_id,
      guest_customer_info,
      booking_id
    } = body;

    logStep("Function started", {
      amount,
      currency,
      idempotency_key,
      user_id,
      guest_customer_info: !!guest_customer_info,
      booking_id
    });

    // Input validation
    if (amount == null) {
      throw new Error('Missing amount');
    }
    if (currency == null) {
      throw new Error('Missing currency');
    }
    if (!booking_id) {
      throw new Error('Missing booking_id');
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Invalid amount: must be a positive number');
    }

    if (!idempotency_key || !isValidUUID(idempotency_key)) {
      throw new Error('Invalid idempotency_key: must be a valid UUID');
    }

    // For guest checkout, user_id is optional but guest_customer_info is required
    if (!user_id && !guest_customer_info) {
      throw new Error('Either user_id or guest_customer_info is required');
    }

    if (user_id && typeof user_id !== 'string') {
      throw new Error('user_id must be a string when provided');
    }

    if (guest_customer_info && (!guest_customer_info.name || !guest_customer_info.email)) {
      throw new Error('guest_customer_info must include name and email');
    }

    // Initialize Supabase client with service role for database operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Check for existing transaction with same idempotency key
    logStep("Checking for existing transaction", { idempotency_key });
    const { data: existingTransaction, error: existingError } = await supabaseServiceRole
      .from('transactions')
      .select('id, payment_intent_id, status, amount')
      .eq('idempotency_key', idempotency_key)
      .single();

    if (existingError && existingError.code !== 'PGRST116') { // PGRST116 = no rows found
      logStep("Error checking existing transaction", { error: existingError });
      throw new Error(`Database error: ${existingError.message}`);
    }

    if (existingTransaction) {
      logStep("Found existing transaction", { transaction_id: existingTransaction.id });
      
      // Verify amount matches (prevent tampering)
      if (existingTransaction.amount !== amount) {
        throw new Error('Amount mismatch with existing transaction');
      }

      return new Response(JSON.stringify({
        client_secret: null, // Will need to fetch from Stripe if needed
        payment_intent_id: existingTransaction.payment_intent_id,
        transaction_id: existingTransaction.id,
        status: existingTransaction.status,
        is_existing: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Initialize Stripe
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || '';
    logStep('Stripe secret loaded', { loaded: !!stripeSecret });
    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
    });

    // Create payment intent metadata
    const metadata: any = {
      idempotency_key,
    };
    
    if (user_id) {
      metadata.user_id = user_id;
    } else if (guest_customer_info) {
      metadata.guest_email = guest_customer_info.email;
      metadata.guest_name = guest_customer_info.name;
      metadata.is_guest = 'true';
    }
    
    // Add booking_id to metadata if provided
    if (booking_id) {
      metadata.booking_id = booking_id;
    }

    // Create Stripe payment intent (payment-first approach)
    logStep("Creating Stripe payment intent", { 
      amount: Math.round(amount * 100), 
      currency, 
      is_guest: !user_id,
      guest_email: guest_customer_info?.email 
    });
    
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        capture_method: 'manual', // Require explicit capture for authorization flow
        metadata,
      }, {
        // Stripe requires idempotencyKey to be passed as an option (second parameter)
        // rather than as a parameter in the PaymentIntent object to prevent duplicate requests
        idempotencyKey: idempotency_key,
      });
    } catch (stripeError) {
      logStep('Stripe payment intent creation failed', { error: stripeError instanceof Error ? stripeError.message : stripeError });
      return new Response(JSON.stringify({ error: 'Failed to create payment intent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    logStep("Payment intent created successfully", { paymentIntentId: paymentIntent.id });

    // Map Stripe status to internal status
    const statusMapping = mapStripeStatus(paymentIntent.status);

    // Create transaction record (set booking_id if provided for booking-first flow)
    logStep("Creating transaction record", { 
      amount, 
      paymentIntentId: paymentIntent.id,
      mappedStatus: statusMapping.internal_status,
      is_guest: !user_id,
      booking_id: booking_id || null
    });
    
    const transactionInsert: any = {
      amount: amount,
      status: statusMapping.internal_status,
      payment_intent_id: paymentIntent.id,
      payment_method: 'card',
      transaction_type: 'authorization',
      currency: currency.toUpperCase(),
      idempotency_key: idempotency_key,
      booking_id: booking_id || null, // Link to booking if provided (booking-first flow)
    };
    
    if (guest_customer_info && !user_id) {
      transactionInsert.guest_customer_email = guest_customer_info.email;
    }
    
    const { data: transactionData, error: transactionError } = await supabaseServiceRole
      .from('transactions')
      .insert(transactionInsert)
      .select('id, status')
      .single();

    if (transactionError) {
      logStep("Transaction creation failed - rolling back payment intent", { error: transactionError });
      
      // Rollback: Cancel the payment intent if transaction creation fails
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
        logStep("Payment intent cancelled successfully");
      } catch (cancelError) {
        logStep("Failed to cancel payment intent", { cancelError });
      }
      
      throw new Error(`Database transaction failed: ${transactionError.message}`);
    }

    const transactionId = transactionData.id;
    logStep("Transaction record created successfully", { transactionId });

    const duration = performance.now() - startTime;
    const response = {
      client_secret: paymentIntent.client_secret,
      transaction_id: transactionId,
      payment_intent_id: paymentIntent.id,
      status: transactionData.status,
    };

    logStep("Payment intent creation completed successfully", { 
      ...response, 
      duration_ms: duration.toFixed(2) 
    });
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-payment-intent", { error: errorMessage });
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (errorMessage.includes('Invalid amount') ||
        errorMessage.includes('Invalid idempotency_key') ||
        errorMessage.includes('user_id') ||
        errorMessage.includes('guest_customer_info') ||
        errorMessage.includes('Amount mismatch') ||
        errorMessage.includes('Missing')) {
      statusCode = 400;
    }

    return new Response(JSON.stringify({
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    });
  }
});
