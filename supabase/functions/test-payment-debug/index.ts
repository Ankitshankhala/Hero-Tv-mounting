import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== PAYMENT DEBUG TEST START ===");
    
    // Test environment variables
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log("Environment check:", {
      hasStripeSecret: !!stripeSecret,
      stripeKeyPrefix: stripeSecret?.substring(0, 8) || 'NOT_SET',
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
      supabaseUrl: supabaseUrl
    });
    
    if (!stripeSecret?.startsWith('sk_')) {
      throw new Error(`Invalid Stripe key: ${stripeSecret?.substring(0, 10)}... (should start with sk_)`);
    }
    
    // Test Stripe import
    console.log("Testing Stripe import...");
    const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
    console.log("Stripe imported successfully");
    
    // Test Stripe initialization
    console.log("Testing Stripe initialization...");
    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });
    console.log("Stripe initialized successfully");
    
    // Test basic Stripe API call
    console.log("Testing Stripe API call...");
    const testIntent = await stripe.paymentIntents.create({
      amount: 100, // $1.00
      currency: 'usd',
      capture_method: 'manual'
    });
    console.log("Stripe API call successful:", { 
      id: testIntent.id, 
      status: testIntent.status,
      amount: testIntent.amount 
    });
    
    // Cancel the test intent
    await stripe.paymentIntents.cancel(testIntent.id);
    console.log("Test intent cancelled successfully");
    
    console.log("=== PAYMENT DEBUG TEST SUCCESS ===");
    
    return new Response(JSON.stringify({
      success: true,
      message: "All payment infrastructure tests passed",
      details: {
        stripeKeyType: stripeSecret.substring(0, 8),
        testIntentId: testIntent.id,
        testStatus: testIntent.status
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("=== PAYMENT DEBUG TEST FAILED ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      type: error.constructor.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});