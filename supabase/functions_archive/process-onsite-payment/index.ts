
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chargeId, customerId, amount, description } = await req.json();

    if (!chargeId || !customerId || !amount) {
      throw new Error("Missing required parameters");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Initialize Supabase with service role key
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get customer details
    const { data: customer, error: customerError } = await supabaseService
      .from('users')
      .select('email')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      throw new Error("Customer not found");
    }

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ 
      email: customer.email, 
      limit: 1 
    });

    let stripeCustomerId;
    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create({
        email: customer.email,
      });
      stripeCustomerId = newCustomer.id;
    }

    // Get customer's payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    if (paymentMethods.data.length === 0) {
      throw new Error("No payment method found for customer");
    }

    // Create and confirm payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethods.data[0].id,
      description: description,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    });

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment failed with status: ${paymentIntent.status}`);
    }

    console.log(`Payment successful for charge ${chargeId}: ${paymentIntent.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        payment_intent_id: paymentIntent.id,
        amount_charged: amount / 100
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Payment processing error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Payment processing failed" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
