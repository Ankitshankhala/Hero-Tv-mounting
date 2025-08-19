import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { booking_id, cancellation_reason = "Worker cancelled booking" } = await req.json();

    if (!booking_id) {
      throw new Error("Booking ID is required");
    }

    // Verify worker has access to this booking
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('worker_id', user.id)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found or access denied");
    }

    if (booking.status === 'cancelled') {
      throw new Error("Booking is already cancelled");
    }

    // Initialize Stripe if payment_intent_id exists
    const stripe = booking.payment_intent_id ? 
      new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2023-10-16",
      }) : null;

    let refundResult = null;

    // Handle payment refund if payment exists
    if (stripe && booking.payment_intent_id) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        
        if (paymentIntent.status === 'succeeded') {
          // Full refund for cancelled booking
          refundResult = await stripe.refunds.create({
            payment_intent: booking.payment_intent_id,
            reason: 'requested_by_customer',
            metadata: {
              booking_id: booking_id,
              cancelled_by: user.id,
              reason: cancellation_reason
            }
          });

          console.log(`[WORKER-CANCEL] Refund created: ${refundResult.id} for amount: ${refundResult.amount}`);
        } else if (paymentIntent.status === 'requires_capture') {
          // Cancel authorization instead of refunding
          await stripe.paymentIntents.cancel(booking.payment_intent_id);
          console.log(`[WORKER-CANCEL] Payment authorization cancelled: ${booking.payment_intent_id}`);
        }
      } catch (stripeError) {
        console.error(`[WORKER-CANCEL] Stripe operation failed:`, stripeError);
        // Continue with booking cancellation even if refund fails
      }
    }

    // Update booking status to cancelled
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({
        status: 'cancelled',
        payment_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', booking_id);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // Create transaction record for refund
    if (refundResult) {
      const supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseService.from('transactions').insert({
        booking_id: booking_id,
        payment_intent_id: booking.payment_intent_id,
        amount: -(refundResult.amount / 100), // Negative for refund
        transaction_type: 'refund',
        status: 'completed',
        stripe_refund_id: refundResult.id,
        cancellation_reason: cancellation_reason,
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString()
      });
    }

    // Log the cancellation
    await supabaseClient.from('sms_logs').insert({
      booking_id: booking_id,
      recipient_number: 'system',
      message: `Booking cancelled by worker: ${cancellation_reason}`,
      status: 'sent'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Booking cancelled successfully",
        refund_amount: refundResult ? refundResult.amount / 100 : 0,
        refund_id: refundResult?.id || null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[WORKER-CANCEL] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to cancel booking"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});