import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mapStripeStatus } from "../shared/status-mapping.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id: bookingId } = await req.json();

    console.log('=== CAPTURE PAYMENT DEBUG ===');
    console.log('Capturing payment for booking:', bookingId);

    if (!bookingId) {
      console.error('No booking ID provided');
      throw new Error('Booking ID is required');
    }

    // Initialize Supabase client with service role
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('Fetching booking details...');
    // Get booking details including pending payment amount
    const { data: booking, error: bookingError } = await supabaseServiceRole
      .from('bookings')
      .select('payment_intent_id, payment_status, status, pending_payment_amount, has_modifications')
      .eq('id', bookingId)
      .maybeSingle();

    console.log('Booking query result:', { booking, bookingError });

    if (bookingError) {
      console.error('Booking error:', bookingError);
      throw new Error(`Failed to fetch booking: ${bookingError.message}`);
    }
    
    if (!booking) {
      console.error('No booking found for ID:', bookingId);
      throw new Error('Booking not found');
    }

    console.log('Booking details:', { 
      payment_intent_id: booking.payment_intent_id, 
      payment_status: booking.payment_status,
      pending_payment_amount: booking.pending_payment_amount,
      has_modifications: booking.has_modifications
    });

    if (!booking.payment_intent_id) {
      console.error('No payment intent found for booking');
      throw new Error('No payment intent found for this booking');
    }

    // Initialize Stripe
    console.log('Initializing Stripe...');
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('No Stripe secret key found');
      throw new Error('Stripe secret key not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    console.log('Checking PaymentIntent status before capture:', booking.payment_intent_id);
    
    // First, retrieve the current PaymentIntent to check its status
    const currentPaymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
    
    console.log('Current PaymentIntent status:', {
      id: currentPaymentIntent.id,
      status: currentPaymentIntent.status,
      amount: currentPaymentIntent.amount
    });

    let paymentIntent;
    
    // Check if already captured/succeeded
    if (currentPaymentIntent.status === 'succeeded') {
      console.log('PaymentIntent already succeeded - no capture needed');
      paymentIntent = currentPaymentIntent;
    } else if (currentPaymentIntent.status === 'requires_capture') {
      console.log('Attempting to capture payment intent:', booking.payment_intent_id);
      // Capture the payment intent
      paymentIntent = await stripe.paymentIntents.capture(booking.payment_intent_id);
    } else {
      console.log('PaymentIntent cannot be captured with status:', currentPaymentIntent.status);
      throw new Error(`Payment cannot be captured. Current status: ${currentPaymentIntent.status}`);
    }

    console.log('Payment capture result:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    });

    // Map Stripe status to internal status  
    const statusMapping = mapStripeStatus(paymentIntent.status, 'payment_intent');
    console.log('Status mapping:', statusMapping);

    if (paymentIntent.status === 'succeeded') {
      console.log('Payment succeeded, updating booking status...');
      console.log('Current booking status:', booking.status, 'payment_status:', booking.payment_status);
      
      // Calculate total amount captured (original + pending if any)
      const originalAmount = paymentIntent.amount / 100;
      const pendingAmount = booking.pending_payment_amount || 0;
      const totalCapturedAmount = originalAmount + pendingAmount;
      
      console.log('Capture amounts:', { originalAmount, pendingAmount, totalCapturedAmount });
      
      // First, update existing transaction to captured status
      console.log('Updating existing transaction to captured status...');
      const { error: transactionUpdateError } = await supabaseServiceRole
        .from('transactions')
        .update({
          status: 'completed',
          captured_at: new Date().toISOString(),
          transaction_type: 'capture',
          amount: totalCapturedAmount // Update to include pending amount
        })
        .eq('payment_intent_id', booking.payment_intent_id)
        .eq('status', 'authorized');

      if (transactionUpdateError) {
        console.error('Failed to update existing transaction:', transactionUpdateError);
        // Don't throw here, we can still proceed with booking update
      }
      
      // If there was a pending payment amount, create additional transaction record
      if (pendingAmount > 0) {
        console.log('Creating additional transaction for pending amount:', pendingAmount);
        const { error: pendingTransactionError } = await supabaseServiceRole
          .from('transactions')
          .insert({
            booking_id: bookingId,
            amount: pendingAmount,
            status: 'completed',
            transaction_type: 'additional_service_charge',
            payment_method: 'existing_payment_method',
            captured_at: new Date().toISOString()
          });

        if (pendingTransactionError) {
          console.error('Failed to create pending transaction:', pendingTransactionError);
        }
      }
      
      // Update booking to completed status and clear pending amounts
      console.log('Updating booking to completed status...');
      const { error: updateError } = await supabaseServiceRole
        .from('bookings')
        .update({
          payment_status: 'captured',
          status: 'completed',
          pending_payment_amount: null, // Clear pending amount
          has_modifications: false // Clear modifications flag
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking:', updateError);
        
        // Enhanced error handling with specific error details
        const errorDetails = {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint
        };
        console.error('Detailed booking update error:', errorDetails);
        
        // Try to provide helpful error message
        if (updateError.message?.includes('violates')) {
          throw new Error(`Database validation error: ${updateError.message}. Please check booking and payment status consistency.`);
        }
        
        throw new Error(`Failed to update booking status: ${updateError.message}`);
      }
      console.log('Booking status updated to completed successfully');

      // Create audit log for the capture
      const { error: auditError } = await supabaseServiceRole
        .from('booking_audit_log')
        .insert({
          booking_id: bookingId,
          operation: 'payment_captured',
          status: 'success',
          payment_intent_id: booking.payment_intent_id,
          details: {
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            stripe_status: paymentIntent.status,
            captured_at: new Date().toISOString()
          }
        });

      if (auditError) {
        console.error('Failed to create audit log:', auditError);
        // Don't fail the whole operation for audit log issues
      }

      console.log('Payment capture completed successfully');

      return new Response(JSON.stringify({
        success: true,
        payment_status: 'captured',
        booking_status: 'completed',
        booking_id: bookingId,
        amount_captured: totalCapturedAmount,
        original_amount: originalAmount,
        pending_amount: pendingAmount,
        currency: paymentIntent.currency,
        message: 'Payment captured and job marked as completed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      console.log('Payment capture failed with status:', paymentIntent.status);
      
      // Create audit log for the failed capture
      await supabaseServiceRole
        .from('booking_audit_log')
        .insert({
          booking_id: bookingId,
          operation: 'payment_capture_failed',
          status: 'error',
          payment_intent_id: booking.payment_intent_id,
          error_message: `Payment capture failed: ${paymentIntent.status}`,
          details: {
            stripe_status: paymentIntent.status,
            attempted_at: new Date().toISOString()
          }
        });
      
      // Update booking to indicate capture failure
      const { error: updateError } = await supabaseServiceRole
        .from('bookings')
        .update({
          payment_status: 'capture_failed',
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking status:', updateError);
      }

      // Update transaction to failed status
      await supabaseServiceRole
        .from('transactions')
        .update({
          status: 'failed',
          cancellation_reason: `Capture failed: ${paymentIntent.status}`
        })
        .eq('payment_intent_id', booking.payment_intent_id)
        .eq('status', 'authorized');

      throw new Error(`Payment capture failed with status: ${paymentIntent.status}. Please contact support if this persists.`);
    }

  } catch (error) {
    console.error('=== CAPTURE PAYMENT ERROR ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      type: error.type,
      code: error.code,
      bookingId
    });
    
    // Create audit log for the error
    try {
      const supabaseServiceRole = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );
      
      await supabaseServiceRole
        .from('booking_audit_log')
        .insert({
          booking_id: bookingId,
          operation: 'payment_capture_error',
          status: 'error',
          error_message: error.message,
          details: {
            error_type: error.type,
            error_code: error.code,
            stack_trace: error.stack,
            timestamp: new Date().toISOString()
          }
        });
    } catch (auditError) {
      console.error('Failed to create error audit log:', auditError);
    }
    
    // Handle specific error types with user-friendly messages
    let errorMessage = 'Payment capture failed';
    let statusCode = 500;
    
    if (error.type && error.type.includes('StripeInvalidRequestError')) {
      errorMessage = 'Invalid payment request. The payment may have already been processed.';
      statusCode = 400;
    } else if (error.type && error.type.includes('StripeCardError')) {
      errorMessage = 'Payment was declined by the card issuer.';
      statusCode = 402;
    } else if (error.message?.includes('violates')) {
      errorMessage = 'Database validation error. Please contact support.';
      statusCode = 409;
    } else if (error.message?.includes('not found')) {
      errorMessage = 'Booking or payment not found.';
      statusCode = 404;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      error_code: error.code,
      booking_id: bookingId,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    });
  }
});