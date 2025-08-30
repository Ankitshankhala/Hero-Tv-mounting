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
  console.log(`[UPDATE-TRANSACTION-STATUS] ${step}${detailsStr}`);
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
    case 'payment_authorized':
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started - parsing request body");
    
    // Check if we have required environment variables
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!stripeSecret || !supabaseUrl || !supabaseServiceKey) {
      logStep("ERROR: Required environment variables not set");
      throw new Error('Required environment variables not set');
    }

    let body;
    try {
      body = await req.json();
      logStep("Request body parsed successfully", body);
    } catch (parseError) {
      logStep("JSON parsing failed", { error: parseError instanceof Error ? parseError.message : parseError });
      throw new Error(`Invalid JSON in request body: ${parseError instanceof Error ? parseError.message : parseError}`);
    }
    
    const { payment_intent_id, status } = body;

    // Input validation
    if (!payment_intent_id) {
      throw new Error('Missing payment_intent_id');
    }
    if (!status) {
      throw new Error('Missing status');
    }

    logStep("Processing transaction status update", {
      payment_intent_id,
      status
    });

    // Initialize Supabase client with service role for database operations
    const supabaseServiceRole = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { auth: { persistSession: false } }
    );

    // Initialize Stripe to verify payment intent status
    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
    });

    // Get the payment intent from Stripe to verify its actual status
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    logStep("Retrieved PaymentIntent from Stripe", { 
      id: paymentIntent.id,
      status: paymentIntent.status 
    });

    // Use the Stripe status as the authoritative source
    const safeStatus = ensureSafeStatus(paymentIntent.status, 'Stripe PaymentIntent status');

    // Find the transaction record
    let { data: transactionData, error: findError } = await supabaseServiceRole
      .from('transactions')
      .select('id, booking_id, status')
      .eq('payment_intent_id', payment_intent_id)
      .maybeSingle();

    if (findError) {
      logStep("Error finding transaction", { error: findError });
      throw new Error(`Database error: ${findError.message}`);
    }

    // If transaction not found, create it from Stripe PaymentIntent data
    if (!transactionData) {
      logStep("Transaction not found, creating from Stripe data", { payment_intent_id });
      
      // Find the booking that has this payment_intent_id
      const { data: bookingData, error: bookingError } = await supabaseServiceRole
        .from('bookings')
        .select('id, service_id, services(base_price)')
        .eq('payment_intent_id', payment_intent_id)
        .single();

      if (bookingError || !bookingData) {
        logStep("No booking found for payment intent", { payment_intent_id, error: bookingError });
        return new Response(JSON.stringify({
          success: false,
          error: `No booking found for payment intent: ${payment_intent_id}`,
          step: 'booking_lookup'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      // Create the missing transaction record
      const newTransactionData = {
        booking_id: bookingData.id,
        payment_intent_id: payment_intent_id,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency.toUpperCase(),
        status: safeStatus,
        payment_method: 'card',
        transaction_type: paymentIntent.status === 'requires_capture' ? 'authorization' : 'charge',
        created_at: new Date().toISOString()
      };

      logStep("Creating missing transaction", newTransactionData);
      
      const { data: createdTransaction, error: createError } = await supabaseServiceRole
        .from('transactions')
        .insert(newTransactionData)
        .select('id, booking_id, status')
        .single();

      if (createError || !createdTransaction) {
        logStep("Failed to create missing transaction", { error: createError });
        const msg = createError?.message || '';
        // Defensive retry: sanitize any bad enum values like 'payment_authorized'
        if (msg.includes('invalid input value for enum payment_status') || msg.includes('payment_authorized')) {
          logStep("Retrying transaction insert with sanitized status 'authorized'");
          const { data: retryTx, error: retryErr } = await supabaseServiceRole
            .from('transactions')
            .insert({ ...newTransactionData, status: 'authorized' })
            .select('id, booking_id, status')
            .single();

          if (!retryErr && retryTx) {
            transactionData = retryTx;
            logStep("Transaction created successfully on retry with sanitized status", { transaction_id: transactionData.id });
          } else {
            logStep("Retry insert failed", { error: retryErr });
            return new Response(JSON.stringify({
              success: false,
              error: `Failed to create missing transaction after retry: ${retryErr?.message || msg}`,
              step: 'transaction_creation_retry'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500,
            });
          }
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to create missing transaction: ${msg}`,
            step: 'transaction_creation'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }
      } else {
        transactionData = createdTransaction;
        logStep("Missing transaction created successfully", { transaction_id: transactionData.id });
      }
    }

    // Update transaction status
    const { data: updatedTransaction, error: updateError } = await supabaseServiceRole
      .from('transactions')
      .update({
        status: safeStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionData.id)
      .select('id, status, booking_id')
      .single();

    if (updateError || !updatedTransaction) {
      logStep("Transaction update failed", { error: updateError });
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to update transaction: ${updateError?.message}`,
        step: 'transaction_update'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    logStep("Transaction updated successfully", {
      transaction_id: updatedTransaction.id,
      new_status: updatedTransaction.status
    });

    // Update booking payment_status and potentially status
    if (transactionData.booking_id) {
      logStep("Starting booking update", { booking_id: transactionData.booking_id });
      
      const bookingUpdate: any = {
        payment_status: safeStatus,
        updated_at: new Date().toISOString()
      };

      // If payment is authorized, update booking status to confirmed (if it's currently pending)
      if (safeStatus === 'authorized') {
        logStep("Checking current booking status before update");
        const { data: currentBooking, error: currentBookingError } = await supabaseServiceRole
          .from('bookings')
          .select('status, payment_status')
          .eq('id', transactionData.booking_id)
          .single();

        if (currentBookingError) {
          logStep("Error fetching current booking", { error: currentBookingError });
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to fetch current booking: ${currentBookingError.message}`,
            step: 'booking_fetch'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }

        logStep("Current booking status", { 
          status: currentBooking?.status, 
          payment_status: currentBooking?.payment_status 
        });

        if (currentBooking?.status === 'pending' || currentBooking?.status === 'payment_pending') {
          bookingUpdate.status = 'payment_authorized';
          logStep("Setting booking status to payment_authorized due to authorized payment");
        }
      }

      logStep("Updating booking with", bookingUpdate);
      const { data: updatedBooking, error: bookingUpdateError } = await supabaseServiceRole
        .from('bookings')
        .update(bookingUpdate)
        .eq('id', transactionData.booking_id)
        .select('id, status, payment_status')
        .single();

      if (bookingUpdateError) {
        logStep("Booking update failed", { error: bookingUpdateError });
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to update booking: ${bookingUpdateError.message}`,
          step: 'booking_update',
          transaction_updated: true,
          transaction_id: updatedTransaction.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      } else {
        logStep("Booking updated successfully", {
          booking_id: updatedBooking.id,
          status: updatedBooking.status,
          payment_status: updatedBooking.payment_status
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      transaction_id: updatedTransaction.id,
      old_status: transactionData.status,
      new_status: updatedTransaction.status,
      payment_intent_id: payment_intent_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in update-transaction-status", { error: errorMessage });
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (errorMessage.includes('not found') || 
        errorMessage.includes('Missing')) {
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