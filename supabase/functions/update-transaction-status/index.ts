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
    const { data: transactionData, error: findError } = await supabaseServiceRole
      .from('transactions')
      .select('id, booking_id, status')
      .eq('payment_intent_id', payment_intent_id)
      .maybeSingle();

    if (findError) {
      logStep("Error finding transaction", { error: findError });
      throw new Error(`Database error: ${findError.message}`);
    }

    if (!transactionData) {
      logStep("Transaction not found", { payment_intent_id });
      throw new Error('Transaction not found');
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
      throw new Error(`Failed to update transaction: ${updateError?.message}`);
    }

    logStep("Transaction updated successfully", {
      transaction_id: updatedTransaction.id,
      new_status: updatedTransaction.status
    });

    // Update booking payment_status and potentially status
    if (transactionData.booking_id) {
      const bookingUpdate: any = {
        payment_status: safeStatus,
        updated_at: new Date().toISOString()
      };

      // If payment is authorized, update booking status to confirmed (if it's currently pending)
      if (safeStatus === 'authorized') {
        const { data: currentBooking } = await supabaseServiceRole
          .from('bookings')
          .select('status')
          .eq('id', transactionData.booking_id)
          .single();

        if (currentBooking?.status === 'pending' || currentBooking?.status === 'payment_pending') {
          bookingUpdate.status = 'confirmed';
          logStep("Setting booking status to confirmed due to authorized payment");
        }
      }

      const { data: updatedBooking, error: bookingUpdateError } = await supabaseServiceRole
        .from('bookings')
        .update(bookingUpdate)
        .eq('id', transactionData.booking_id)
        .select('id, status, payment_status')
        .single();

      if (bookingUpdateError) {
        logStep("Booking update failed", { error: bookingUpdateError });
        // Don't fail the entire operation for booking update issues
        console.warn('Failed to update booking status:', bookingUpdateError);
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