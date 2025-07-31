import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-CHECKOUT-SESSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    logStep("CORS preflight request handled");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      throw new Error("Missing session_id");
    }

    logStep("Verifying session", { sessionId: session_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    logStep("Session retrieved", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      bookingId: session.metadata?.booking_id
    });

    if (!session.metadata?.booking_id) {
      throw new Error("No booking ID found in session metadata");
    }

    const bookingId = session.metadata.booking_id;

    // Update transaction status based on payment status
    let transactionStatus = "pending";
    let bookingStatus = "payment_pending";

    if (session.payment_status === "paid") {
      transactionStatus = "completed";
      bookingStatus = "confirmed";
    } else if (session.payment_status === "unpaid") {
      transactionStatus = "failed";
      bookingStatus = "payment_pending";
    }

    logStep("Status mapping", {
      stripePaymentStatus: session.payment_status,
      transactionStatus,
      bookingStatus
    });

    // Update transaction
    const { error: transactionError } = await supabase
      .from("transactions")
      .update({
        status: transactionStatus,
        payment_intent_id: session.payment_intent
      })
      .eq("booking_id", bookingId);

    if (transactionError) {
      logStep("Transaction update failed", { error: transactionError });
    }

    // Update booking
    const { error: bookingError } = await supabase
      .from("bookings")
      .update({
        status: bookingStatus,
        payment_status: transactionStatus === "completed" ? "completed" : "pending"
      })
      .eq("id", bookingId);

    if (bookingError) {
      logStep("Booking update failed", { error: bookingError });
    }

    logStep("Records updated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        payment_status: session.payment_status,
        booking_id: bookingId,
        booking_status: bookingStatus
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in verify-checkout-session", { error: errorMessage });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});