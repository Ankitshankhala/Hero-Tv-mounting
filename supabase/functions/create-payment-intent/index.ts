import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Utility function to validate UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Enhanced logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-INTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let paymentIntent: any = null;
  let transactionId: string | null = null;

  try {
    const { amount, currency = 'usd', booking_id, user_id, idempotency_key } = await req.json();
    
    logStep("Function started", { amount, currency, booking_id, user_id, idempotency_key });

    // Input validation
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new Error('Invalid amount: must be a positive number');
    }

    if (!user_id || typeof user_id !== 'string') {
      throw new Error('user_id is required and must be a string');
    }

    // Validate booking ID is required and valid UUID
    if (!booking_id || typeof booking_id !== 'string') {
      throw new Error('booking_id is required and must be a string');
    }

    if (!isValidUUID(booking_id)) {
      logStep("Invalid booking ID format", { booking_id });
      throw new Error('Invalid booking_id format: must be a valid UUID');
    }

    // Check for existing payment intent with same idempotency key
    if (idempotency_key) {
      logStep("Checking for existing payment intent", { idempotency_key });
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
    logStep("Stripe initialized");

    // Verify booking exists and is in correct state
    logStep("Verifying booking exists and is pending", { booking_id });
    const { data: bookingCheck, error: bookingCheckError } = await supabaseServiceRole
      .from('bookings')
      .select('id, status, payment_status, customer_id')
      .eq('id', booking_id)
      .single();

    if (bookingCheckError || !bookingCheck) {
      logStep("Booking not found", { booking_id, error: bookingCheckError });
      throw new Error('Booking not found or inaccessible');
    }

    if (bookingCheck.customer_id !== user_id) {
      logStep("User not authorized for booking", { booking_customer: bookingCheck.customer_id, request_user: user_id });
      throw new Error('User not authorized to create payment for this booking');
    }

    if (bookingCheck.status !== 'pending' || bookingCheck.payment_status !== 'pending') {
      logStep("Booking not in correct state for payment", { status: bookingCheck.status, payment_status: bookingCheck.payment_status });
      throw new Error('Booking is not in correct state for payment creation');
    }

    // Create payment intent
    logStep("Creating Stripe payment intent", { amount: Math.round(amount * 100), currency });
    paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      capture_method: 'manual', // Require explicit capture for authorization flow
      metadata: {
        user_id: user_id,
        booking_id: booking_id,
        idempotency_key: idempotency_key || 'none',
      },
    });

    logStep("Payment intent created successfully", { paymentIntentId: paymentIntent.id });

    // Insert transaction record
    try {
      logStep("Creating transaction record", { 
        booking_id, 
        user_id, 
        amount, 
        paymentIntentId: paymentIntent.id 
      });
      
      const { data: transactionData, error: transactionError } = await supabaseServiceRole
        .from('transactions')
        .insert({
          booking_id: booking_id,
          amount: amount,
          status: 'pending', // Start as pending, not authorized
          payment_intent_id: paymentIntent.id,
          payment_method: 'card',
          transaction_type: 'authorization',
          currency: currency.toUpperCase(),
        })
        .select('id')
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

      transactionId = transactionData.id;
      logStep("Transaction record created successfully", { transactionId });

    } catch (error) {
      logStep("Error in transaction creation", { error: error.message });
      
      // Rollback: Cancel the payment intent if transaction creation fails
      if (paymentIntent?.id) {
        try {
          await stripe.paymentIntents.cancel(paymentIntent.id);
          logStep("Payment intent cancelled due to database error");
        } catch (cancelError) {
          logStep("Failed to cancel payment intent during rollback", { cancelError });
        }
      }
      
      throw error; // Re-throw to be caught by outer try-catch
    }

    const response = {
      client_secret: paymentIntent.client_secret,
      transaction_id: transactionId,
      payment_intent_id: paymentIntent.id,
    };

    logStep("Payment intent creation completed successfully", response);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-payment-intent", { error: errorMessage });
    
    // If we have a payment intent but an error occurred, try to cancel it
    if (paymentIntent?.id) {
      try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
          apiVersion: '2023-10-16',
        });
        await stripe.paymentIntents.cancel(paymentIntent.id);
        logStep("Payment intent cancelled due to error");
      } catch (cancelError) {
        logStep("Failed to cancel payment intent in error handler", { cancelError });
      }
    }
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (errorMessage.includes('Invalid amount') || 
        errorMessage.includes('user_id is required') ||
        errorMessage.includes('Invalid booking_id format')) {
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