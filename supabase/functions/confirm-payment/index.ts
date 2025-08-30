import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mapStripeStatus, getStatusForFrontend } from "../shared/status-mapping.ts";

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
    const { 
      payment_intent_id, 
      booking_id, 
      guest_booking_data 
    } = await req.json();
    
    logStep("Function started", { 
      payment_intent_id, 
      booking_id, 
      has_guest_data: !!guest_booking_data 
    });

    // Input validation
    if (!payment_intent_id || typeof payment_intent_id !== 'string') {
      throw new Error('payment_intent_id is required and must be a string');
    }

    // booking_id is optional if we're creating a guest booking after payment
    if (!booking_id && !guest_booking_data) {
      throw new Error('Either booking_id or guest_booking_data is required');
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
    
    logStep("Payment intent retrieved", { 
      status: paymentIntent.status, 
      amount: paymentIntent.amount,
      capture_method: paymentIntent.capture_method 
    });

    // Map Stripe status to internal status
    const statusMapping = mapStripeStatus(paymentIntent.status);

    // Check if payment is in a successful state
    if (!['requires_capture', 'succeeded'].includes(paymentIntent.status)) {
      logStep("Payment intent not in successful state", { status: paymentIntent.status });
      throw new Error(`Payment not completed. Status: ${paymentIntent.status} - ${statusMapping.user_message}`);
    }

    logStep("Payment intent verified as successful", { 
      amount: paymentIntent.amount,
      status: paymentIntent.status,
      mapped_status: statusMapping.internal_status
    });

    let finalBookingId = booking_id;

    // Handle guest booking creation or existing booking update
    if (guest_booking_data && !booking_id) {
      // Create guest booking after payment authorization
      logStep("Creating guest booking after payment authorization");
      
      const bookingInsert = {
        ...guest_booking_data,
        status: statusMapping.booking_status,
        payment_status: statusMapping.payment_status,
        payment_intent_id: payment_intent_id,
        customer_id: null, // Guest booking
        guest_customer_info: guest_booking_data.guest_customer_info,
      };
      
      const { data: newBooking, error: bookingCreateError } = await supabaseServiceRole
        .from('bookings')
        .insert(bookingInsert)
        .select('id')
        .single();

      if (bookingCreateError) {
        logStep("Guest booking creation failed", { error: bookingCreateError });
        throw new Error(`Failed to create guest booking: ${bookingCreateError.message}`);
      }

      finalBookingId = newBooking.id;
      logStep("Guest booking created successfully", { bookingId: newBooking.id });

      // Trigger worker assignment for guest booking
      try {
        logStep("Attempting worker auto-assignment for guest booking");
        const { data: assignmentData, error: assignmentError } = await supabaseServiceRole.rpc(
          'auto_assign_workers_with_coverage',
          { p_booking_id: newBooking.id }
        );

        if (assignmentError) {
          logStep("Guest booking worker assignment failed", { error: assignmentError });
        } else {
          logStep("Guest booking worker assignment completed", assignmentData);
        }
      } catch (assignmentError) {
        logStep("Guest booking worker assignment error", { error: assignmentError });
        // Don't fail the payment confirmation for assignment errors
      }
      
    } else if (booking_id) {
      // Update existing booking status
      logStep("Updating existing booking status", { booking_id, mapped_status: statusMapping.booking_status });
      const { error: bookingError } = await supabaseServiceRole
        .from('bookings')
        .update({ 
          status: statusMapping.booking_status,
          payment_status: statusMapping.payment_status,
          payment_intent_id: payment_intent_id
        })
        .eq('id', booking_id);

      if (bookingError) {
        logStep("Failed to update booking - trying RPC fallback", { error: bookingError });
        
        // Try the RPC fallback for payment status fixes
        const { data: rpcResult, error: rpcError } = await supabaseServiceRole
          .rpc('fix_booking_payment_status', {
            p_booking_id: booking_id,
            p_payment_intent_id: payment_intent_id
          });
        
        if (rpcError || !rpcResult?.success) {
          logStep("RPC fallback also failed", { rpcError, rpcResult });
          throw new Error(`Failed to update booking: ${bookingError.message}`);
        }
        
        logStep("RPC fallback succeeded", { rpcResult });
      }

      logStep("Booking updated successfully", { booking_id });
    }

    // Update transaction status with payment method info
    logStep("Updating transaction status", { payment_intent_id, mapped_status: statusMapping.internal_status });
    
    // Get payment method details from Stripe
    let paymentMethodDetails = null;
    try {
      if (paymentIntent.payment_method) {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
        paymentMethodDetails = {
          type: paymentMethod.type,
          last4: paymentMethod.card?.last4,
          brand: paymentMethod.card?.brand,
          exp_month: paymentMethod.card?.exp_month,
          exp_year: paymentMethod.card?.exp_year
        };
        logStep("Retrieved payment method details", paymentMethodDetails);
      }
    } catch (pmError) {
      logStep("Failed to retrieve payment method details", { error: pmError });
    }

    const { data: transactionUpdate, error: transactionError } = await supabaseServiceRole
      .from('transactions')
      .update({ 
        status: statusMapping.internal_status,
        booking_id: finalBookingId,
        payment_method: paymentMethodDetails ? `${paymentMethodDetails.brand} ending in ${paymentMethodDetails.last4}` : 'card',
        transaction_type: paymentIntent.capture_method === 'manual' ? 'authorization' : 'charge'
      })
      .eq('payment_intent_id', payment_intent_id)
      .select('id, status')
      .single();

    if (transactionError) {
      logStep("Failed to update transaction", { error: transactionError });
      // Don't throw here as booking is already confirmed
      // Just log the error for manual review
    } else {
      logStep("Transaction updated successfully", { transactionUpdate });
    }

    // Get frontend-friendly status
    const frontendStatus = getStatusForFrontend(
      statusMapping.booking_status,
      statusMapping.payment_status,
      statusMapping.internal_status
    );

    const response = {
      success: true,
      booking_id: finalBookingId,
      payment_intent_id: payment_intent_id,
      status: statusMapping.booking_status,
      payment_status: statusMapping.payment_status,
      frontend_status: frontendStatus,
      user_message: statusMapping.user_message,
      booking_created: !!guest_booking_data && !booking_id
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