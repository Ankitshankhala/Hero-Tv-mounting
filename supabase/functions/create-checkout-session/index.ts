import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT-SESSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    logStep("CORS preflight request handled");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Environment validation
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    logStep("Environment variables validated", {
      hasStripeSecret: !!stripeKey,
      stripeKeyType: stripeKey.substring(0, 8) + "...",
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey
    });

    // Parse request body
    const body = await req.json();
    logStep("Request body parsed", {
      bookingId: body.booking_id,
      amount: body.amount,
      customerName: body.customer_name,
      customerEmail: body.customer_email
    });

    const { booking_id, amount, customer_name, customer_email } = body;

    if (!booking_id || !amount || !customer_email) {
      throw new Error("Missing required fields: booking_id, amount, customer_email");
    }

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    logStep("Clients initialized");

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    logStep("Booking retrieved", { bookingId: booking.id, status: booking.status });

    // Check if customer exists in Stripe
    const customers = await stripe.customers.list({
      email: customer_email,
      limit: 1
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing Stripe customer found", { customerId });
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: customer_email,
        name: customer_name
      });
      customerId = customer.id;
      logStep("New Stripe customer created", { customerId });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Service Booking",
              description: `Booking #${booking_id.slice(0, 8)}`
            },
            unit_amount: Math.round(amount * 100) // Convert to cents
          },
          quantity: 1
        }
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/?cancelled=true`,
      metadata: {
        booking_id: booking_id,
        customer_email: customer_email
      }
    });

    logStep("Stripe checkout session created", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      url: session.url
    });

    // Create transaction record
    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        booking_id: booking_id,
        amount: amount,
        currency: "usd",
        status: "pending",
        payment_intent_id: session.payment_intent,
        transaction_type: "charge"
      });

    if (transactionError) {
      logStep("Transaction creation failed", { error: transactionError });
      throw new Error(`Failed to create transaction: ${transactionError.message}`);
    }

    logStep("Transaction record created");

    // Update booking with payment session info
    const { error: bookingUpdateError } = await supabase
      .from("bookings")
      .update({
        stripe_customer_id: customerId,
        status: "payment_pending"
      })
      .eq("id", booking_id);

    if (bookingUpdateError) {
      logStep("Booking update failed", { error: bookingUpdateError });
    }

    logStep("Booking updated with payment session info");

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout-session", { error: errorMessage });
    
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