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

  try {
    const { bookingId, amount, customerEmail, customerName, requireAuth } = await req.json();
    
    logStep("Function started", { bookingId, amount, customerEmail });

    // Input validation
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount: must be greater than 0');
    }

    if (!customerEmail) {
      throw new Error('Customer email is required');
    }

    // Validate booking ID format if provided
    let validBookingId = null;
    let requiresBookingCreation = false;

    if (bookingId && bookingId !== "temp-booking-ref") {
      if (!isValidUUID(bookingId)) {
        logStep("Invalid booking ID format", { bookingId });
        throw new Error('Invalid booking ID format: must be a valid UUID');
      }
      validBookingId = bookingId;
      logStep("Valid booking ID provided", { validBookingId });
    } else {
      requiresBookingCreation = true;
      logStep("No valid booking ID - payment intent will be created without transaction record");
    }

    // Initialize Supabase client with service role for database operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep("Processing payment intent creation", { validBookingId, requiresBookingCreation });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });
    logStep("Stripe initialized");

    let customerId;
    
    // Create or find Stripe customer if email provided
    if (customerEmail) {
      logStep("Looking for existing Stripe customer", { customerEmail });
      const customers = await stripe.customers.list({ 
        email: customerEmail, 
        limit: 1 
      });
      
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing customer", { customerId });
      } else {
        logStep("Creating new Stripe customer");
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName || undefined,
        });
        customerId = customer.id;
        logStep("Created new customer", { customerId });
      }
    }

    // Create payment intent with manual capture
    logStep("Creating Stripe payment intent", { amount: Math.round(amount * 100) });
    paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: customerId,
      capture_method: 'manual',
      metadata: {
        booking_id: validBookingId || bookingId || 'no-booking',
      },
    });

    logStep("Payment intent created successfully", { paymentIntentId: paymentIntent.id });

    // Create transaction record only if we have a valid booking ID
    if (validBookingId) {
      try {
        logStep("Creating transaction record", { validBookingId, paymentIntentId: paymentIntent.id });
        
        const { error: transactionError } = await supabaseServiceRole
          .from('transactions')
          .insert({
            booking_id: validBookingId,
            amount: amount,
            status: 'pending',
            payment_intent_id: paymentIntent.id,
            payment_method: 'card',
            transaction_type: 'authorization',
            currency: 'USD',
          });

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
        } else {
          logStep("Transaction record created successfully");
        }
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
    } else {
      logStep("Skipping transaction creation - no valid booking ID provided");
    }

    const response = {
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      stripe_customer_id: customerId,
      requires_booking_creation: requiresBookingCreation,
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
    
    // Determine error code for frontend handling
    let errorCode = 'UNKNOWN_ERROR';
    if (errorMessage.includes('Invalid booking ID format')) {
      errorCode = 'INVALID_BOOKING_ID';
    } else if (errorMessage.includes('Invalid amount')) {
      errorCode = 'INVALID_AMOUNT';
    } else if (errorMessage.includes('Customer email is required')) {
      errorCode = 'MISSING_EMAIL';
    } else if (errorMessage.includes('Database transaction failed')) {
      errorCode = 'DATABASE_ERROR';
    } else if (errorMessage.includes('Stripe')) {
      errorCode = 'STRIPE_ERROR';
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      error_code: errorCode,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});