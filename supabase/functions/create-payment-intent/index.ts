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
  console.log(`[CREATE-PAYMENT-INTENT] ${step}${detailsStr}`);
};

// Universal safe status function for authorization workflow - supports authorized status
const ensureSafeStatus = (status: string, context: string = 'unknown'): string => {
  logStep(`Validating status for ${context}`, { inputStatus: status, statusType: typeof status });
  
  // Normalize status to lowercase for case-insensitive matching
  const normalizedStatus = String(status).toLowerCase().trim();
  
  let safeStatus: string;
  
  switch (normalizedStatus) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
    case 'pending':
      safeStatus = 'pending';
      break;
    case 'requires_capture':
    case 'authorized':
      safeStatus = 'authorized';
      break;
    case 'succeeded':
    case 'completed':
      safeStatus = 'completed';
      break;
    case 'captured':
      safeStatus = 'captured';
      break;
    case 'canceled':
    case 'cancelled':
    case 'failed':
    case 'payment_failed':
    default:
      safeStatus = 'failed';
      break;
  }
  
  // Final validation - ensure status is valid for our enum
  const validStatuses = ['pending', 'completed', 'failed', 'authorized', 'captured', 'cancelled'];
  if (!validStatuses.includes(safeStatus)) {
    logStep(`Invalid status detected for ${context}, forcing to failed`, { invalidStatus: safeStatus });
    safeStatus = 'failed';
  }
  
  logStep(`Status validation completed for ${context}`, { 
    originalStatus: status,
    normalizedStatus: normalizedStatus,
    finalSafeStatus: safeStatus 
  });
  
  return safeStatus;
};

// Enhanced status mapping function with defensive validation
const mapStripeStatus = (stripeStatus: string): string => {
  return ensureSafeStatus(stripeStatus, 'Stripe status mapping');
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
    logStep("CORS preflight request handled");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started - parsing request body");
    
    // Check if we have required environment variables first
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!stripeSecret) {
      logStep("ERROR: STRIPE_SECRET_KEY environment variable not set");
      throw new Error('STRIPE_SECRET_KEY environment variable not set');
    }
    
    // CRITICAL: Validate that we have a SECRET key, not a publishable key
    if (!stripeSecret.startsWith('sk_')) {
      logStep("ERROR: Invalid Stripe key format - must be secret key starting with sk_", { 
        keyPrefix: stripeSecret.substring(0, 3),
        expectedPrefix: 'sk_'
      });
      throw new Error('STRIPE_SECRET_KEY must be a secret key starting with sk_, not a publishable key');
    }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      logStep("ERROR: Supabase environment variables not set", { supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey });
      throw new Error('Supabase environment variables not set');
    }
    
    logStep("Environment variables validated", { 
      hasStripeSecret: !!stripeSecret,
      stripeKeyType: stripeSecret.substring(0, 8),
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey
    });

    let body;
    try {
      body = await req.json();
      logStep("Request body parsed successfully", body);
    } catch (parseError) {
      logStep("JSON parsing failed", { error: parseError instanceof Error ? parseError.message : parseError });
      throw new Error(`Invalid JSON in request body: ${parseError instanceof Error ? parseError.message : parseError}`);
    }
    
    const {
      amount,
      currency,
      idempotency_key,
      user_id,
      guest_customer_info,
      booking_id,
      testing_mode
    } = body;

    logStep("Processing payment intent request", {
      amount,
      currency,
      idempotency_key,
      user_id,
      guest_customer_info: !!guest_customer_info,
      booking_id,
      testing_mode: !!testing_mode
    });

    // Input validation
    if (amount == null) {
      throw new Error('Missing amount');
    }
    if (currency == null) {
      throw new Error('Missing currency');
    }
    if (!booking_id) {
      throw new Error('Missing booking_id - booking must be created before payment intent');
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
      supabaseUrl,
      supabaseServiceKey,
      { auth: { persistSession: false } }
    );

    // Check for existing transaction with same idempotency key
    logStep("Checking for existing transaction", { idempotency_key });
    const { data: existingTransaction, error: existingError } = await supabaseServiceRole
      .from('transactions')
      .select('id, payment_intent_id, status, amount')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle();

    if (existingError) {
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
    logStep('Initializing Stripe client');
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
    
    // Add testing mode flag to prevent accidental real charges
    if (testing_mode) {
      metadata.test_mode = 'true';
      logStep("Testing mode enabled - payment intent marked as test", { test_mode: true });
    }

    // Create Stripe payment intent with manual capture for authorization
    // CRITICAL FIX: Amount should already be in dollars, convert to cents here
    const amountInCents = Math.round(amount * 100);
    
    // Add amount validation to prevent unreasonably high charges
    if (amountInCents > 1000000) { // $10,000 limit
      throw new Error(`Amount too high: $${amount}. Maximum allowed is $10,000.`);
    }
    
    logStep("Creating Stripe payment intent for authorization", { 
      originalAmount: amount,
      amountInCents: amountInCents, 
      currency, 
      is_guest: !user_id,
      guest_email: guest_customer_info?.email 
    });
    
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents, // Correctly converted to cents
        currency: currency.toLowerCase(),
        capture_method: 'manual', // Manual capture - authorize now, charge later
        metadata: {
          ...metadata,
          original_amount_dollars: amount.toString() // Track original amount for debugging
        },
      }, {
        // Stripe requires idempotencyKey to be passed as an option (second parameter)
        // rather than as a parameter in the PaymentIntent object to prevent duplicate requests
        idempotencyKey: idempotency_key,
      });
      
      logStep("Stripe payment intent created successfully", { 
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount
      });
      
    } catch (stripeError) {
      logStep('Stripe payment intent creation failed', { 
        error: stripeError instanceof Error ? stripeError.message : stripeError,
        errorType: stripeError instanceof Error ? stripeError.constructor.name : typeof stripeError
      });
      return new Response(JSON.stringify({ 
        error: 'Failed to create payment intent',
        details: stripeError instanceof Error ? stripeError.message : String(stripeError)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Use universal safe status validation for ALL database operations
    const safeStatus = ensureSafeStatus(paymentIntent.status, 'transaction insert');

    // Create transaction record (set booking_id if provided for booking-first flow)
    logStep("Creating transaction record", { 
      amount, 
      paymentIntentId: paymentIntent.id,
      safeStatus: safeStatus,
      is_guest: !user_id,
      booking_id: booking_id || null
    });
    
    const transactionInsert: any = {
      amount: amount,
      status: safeStatus, // Use safe validated status for database enum compatibility
      payment_intent_id: paymentIntent.id,
      payment_method: 'card',
      transaction_type: 'authorization', // Authorization for later capture
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

    // Update booking with payment_intent_id and appropriate status for direct capture
    if (booking_id) {
      logStep("Updating booking with payment intent", { booking_id, payment_intent_id: paymentIntent.id });
      
      // For authorization workflow, set booking status based on payment status
      // Use 'payment_authorized' status properly when payment is authorized
      const bookingStatus = safeStatus === 'authorized' ? 'payment_authorized' : 'payment_pending';
      const bookingPaymentStatus = safeStatus === 'pending' ? 'payment_pending' : safeStatus;
      
      const { error: bookingUpdateError } = await supabaseServiceRole
        .from('bookings')
        .update({
          payment_intent_id: paymentIntent.id,
          status: bookingStatus,
          payment_status: bookingPaymentStatus // Fix payment_status mapping
        })
        .eq('id', booking_id);

      if (bookingUpdateError) {
        logStep("Booking update failed", { error: bookingUpdateError, booking_id });
        
        // This is critical - rollback both transaction and payment intent
        try {
          await Promise.all([
            supabaseServiceRole.from('transactions').delete().eq('id', transactionId),
            stripe.paymentIntents.cancel(paymentIntent.id)
          ]);
          logStep("Rollback completed - transaction and payment intent cancelled");
        } catch (rollbackError) {
          logStep("Failed to rollback", { rollbackError });
        }
        
        throw new Error(`Failed to update booking: ${bookingUpdateError.message}`);
      }
      
      logStep("Booking updated successfully", { booking_id, status: bookingStatus });
    }

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