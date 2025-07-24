import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withIdempotency, IdempotencyManager } from "../shared/idempotency.ts";
import { mapStripeStatus } from "../shared/status-mapping.ts";

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

  try {
    const { 
      amount, 
      currency = 'usd', 
      booking_id, 
      user_id, 
      idempotency_key,
      guest_customer_info 
    } = await req.json();
    
    logStep("Function started", { amount, currency, booking_id, user_id, guest_customer_info: !!guest_customer_info, idempotency_key });

    // Input validation
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new Error('Invalid amount: must be a positive number');
    }

    // For guest bookings, user_id is optional but guest_customer_info is required
    if (!user_id && !guest_customer_info) {
      throw new Error('Either user_id or guest_customer_info is required');
    }

    if (user_id && typeof user_id !== 'string') {
      throw new Error('user_id must be a string when provided');
    }

    // booking_id is optional for new bookings created during payment flow
    if (booking_id && typeof booking_id !== 'string') {
      throw new Error('booking_id must be a string when provided');
    }

    if (booking_id && !isValidUUID(booking_id)) {
      logStep("Invalid booking ID format", { booking_id });
      throw new Error('Invalid booking_id format: must be a valid UUID');
    }

    // Generate idempotency key if not provided
    const manager = new IdempotencyManager(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const finalIdempotencyKey = idempotency_key || 
      manager.generateIdempotencyKey('payment_intent', user_id || guest_customer_info?.email || 'guest');

    // Wrap operation in idempotency handler
    const result = await withIdempotency(
      finalIdempotencyKey,
      'payment_intent',
      { amount, currency, booking_id, user_id, guest_customer_info },
      user_id || guest_customer_info?.email || 'guest',
      async () => {
        return await createPaymentIntentInternal(amount, currency, booking_id, user_id, guest_customer_info);
      },
      30 // 30 minute TTL for payment intents
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-payment-intent", { error: errorMessage });
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (errorMessage.includes('Invalid amount') || 
        errorMessage.includes('user_id is required') ||
        errorMessage.includes('Invalid booking_id format') ||
        errorMessage.includes('idempotency key reused')) {
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

// Internal function that performs the actual payment intent creation
async function createPaymentIntentInternal(
  amount: number, 
  currency: string, 
  booking_id: string | undefined, 
  user_id: string | undefined,
  guest_customer_info?: any
) {
  let paymentIntent: any = null;

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

  try {
    // For existing bookings, verify they exist and are in correct state
    if (booking_id) {
      logStep("Verifying existing booking", { booking_id });
      const { data: bookingCheck, error: bookingCheckError } = await supabaseServiceRole
        .from('bookings')
        .select('id, status, payment_status, customer_id, guest_customer_info')
        .eq('id', booking_id)
        .single();

      if (bookingCheckError || !bookingCheck) {
        logStep("Booking not found", { booking_id, error: bookingCheckError });
        throw new Error('Booking not found or inaccessible');
      }

      // Check authorization for authenticated users or guest bookings
      if (user_id && bookingCheck.customer_id !== user_id) {
        logStep("User not authorized for booking", { booking_customer: bookingCheck.customer_id, request_user: user_id });
        throw new Error('User not authorized to create payment for this booking');
      }

      if (bookingCheck.status !== 'pending' || bookingCheck.payment_status !== 'pending') {
        logStep("Booking not in correct state for payment", { status: bookingCheck.status, payment_status: bookingCheck.payment_status });
        throw new Error('Booking is not in correct state for payment creation');
      }
    } else {
      logStep("Creating payment intent without existing booking", { is_guest: !user_id });
    }

    // Create payment intent with guest support
    logStep("Creating Stripe payment intent", { 
      amount: Math.round(amount * 100), 
      currency, 
      is_guest: !user_id,
      guest_email: guest_customer_info?.email 
    });
    
    const metadata: any = {
      booking_id: booking_id || 'pending_creation',
    };
    
    if (user_id) {
      metadata.user_id = user_id;
    } else if (guest_customer_info) {
      metadata.guest_email = guest_customer_info.email;
      metadata.guest_name = guest_customer_info.name;
      metadata.is_guest = 'true';
    }
    
    paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      capture_method: 'manual', // Require explicit capture for authorization flow
      metadata,
    });

    logStep("Payment intent created successfully", { paymentIntentId: paymentIntent.id });

    // Map Stripe status to internal status
    const statusMapping = mapStripeStatus(paymentIntent.status);

    // Insert transaction record
    logStep("Creating transaction record", { 
      booking_id, 
      user_id, 
      amount, 
      paymentIntentId: paymentIntent.id,
      mappedStatus: statusMapping.internal_status,
      is_guest: !user_id
    });
    
    const transactionInsert: any = {
      amount: amount,
      status: statusMapping.internal_status,
      payment_intent_id: paymentIntent.id,
      payment_method: 'card',
      transaction_type: 'authorization',
      currency: currency.toUpperCase(),
    };
    
    if (booking_id) {
      transactionInsert.booking_id = booking_id;
    }
    
    if (guest_customer_info && !user_id) {
      transactionInsert.guest_customer_email = guest_customer_info.email;
    }
    
    const { data: transactionData, error: transactionError } = await supabaseServiceRole
      .from('transactions')
      .insert(transactionInsert)
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

    const transactionId = transactionData.id;
    logStep("Transaction record created successfully", { transactionId });

    const response = {
      client_secret: paymentIntent.client_secret,
      transaction_id: transactionId,
      payment_intent_id: paymentIntent.id,
      status_mapping: statusMapping,
    };

    logStep("Payment intent creation completed successfully", response);
    return response;

  } catch (error) {
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
    
    throw error;
  }
}