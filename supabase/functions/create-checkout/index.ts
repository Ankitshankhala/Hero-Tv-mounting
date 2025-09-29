import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, amount, description, customerEmail } = await req.json();

    console.log(`[CREATE-CHECKOUT] Creating checkout for booking ${bookingId}, amount: ${amount}`);

    const checkoutSession = {
      id: `cs_${Date.now()}`,
      url: `https://checkout.stripe.com/c/pay/cs_${Date.now()}`,
      booking_id: bookingId,
      amount: amount,
      description: description,
      customer_email: customerEmail,
      status: 'open',
      created_at: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        checkoutSession,
        message: 'Checkout session created successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error(`[CREATE-CHECKOUT] Error creating checkout - ${error.message}`);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});