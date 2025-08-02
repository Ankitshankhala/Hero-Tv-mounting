import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Test the key by listing customers (safe operation)
    const customers = await stripe.customers.list({ limit: 1 });
    
    const keyType = stripeKey.startsWith('sk_live_') ? 'live' : 
                   stripeKey.startsWith('sk_test_') ? 'test' : 'unknown';
    
    return new Response(JSON.stringify({
      success: true,
      keyType: keyType,
      keyPrefix: stripeKey.substring(0, 8) + '...',
      message: `Stripe ${keyType} key is working correctly`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});