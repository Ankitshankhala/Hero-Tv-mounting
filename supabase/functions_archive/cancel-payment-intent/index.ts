import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancelPaymentRequest {
  paymentIntentId: string;
  reason?: string;
  refundAmount?: number; // Optional partial refund amount in cents
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paymentIntentId, reason = "booking_creation_failed", refundAmount }: CancelPaymentRequest = await req.json();

    if (!paymentIntentId) {
      throw new Error("Payment intent ID is required");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Initialize Supabase with service role for database updates
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    console.log(`Processing payment cancellation for intent: ${paymentIntentId}`);

    // Get payment intent details from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    let cancellationResult: any = null;
    let cancellationType = "";

    if (paymentIntent.status === "requires_capture" || paymentIntent.status === "requires_confirmation") {
      // Payment is authorized but not captured - we can cancel it
      cancellationResult = await stripe.paymentIntents.cancel(paymentIntentId, {
        cancellation_reason: "requested_by_customer"
      });
      cancellationType = "cancelled";
      console.log(`Payment intent ${paymentIntentId} cancelled successfully`);
    } else if (paymentIntent.status === "succeeded") {
      // Payment was captured - we need to create a refund
      const refundParams: any = {
        payment_intent: paymentIntentId,
        reason: "requested_by_customer"
      };
      
      if (refundAmount && refundAmount < paymentIntent.amount) {
        refundParams.amount = refundAmount;
      }
      
      cancellationResult = await stripe.refunds.create(refundParams);
      cancellationType = "refunded";
      console.log(`Payment intent ${paymentIntentId} refunded successfully`);
    } else {
      throw new Error(`Cannot cancel payment intent with status: ${paymentIntent.status}`);
    }

    // Update transaction status in database - use 'failed' for payment_status enum compatibility
    console.log(`Updating transaction status to failed for payment intent: ${paymentIntentId}`);
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'failed', // Use 'failed' instead of 'cancelled' for payment_status enum compatibility
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason
      })
      .eq('payment_intent_id', paymentIntentId);

    if (updateError) {
      console.error('Failed to update transaction status:', updateError);
      // Don't throw here as the Stripe cancellation succeeded
    }

    return new Response(
      JSON.stringify({
        success: true,
        cancellationType,
        stripeResponse: cancellationResult,
        message: `Payment ${cancellationType} successfully`,
        refundAmount: cancellationType === "refunded" ? (cancellationResult.amount || paymentIntent.amount) : paymentIntent.amount
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Payment cancellation error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: "Failed to cancel payment"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});