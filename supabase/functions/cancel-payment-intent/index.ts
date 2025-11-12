import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { createStripeClient, corsHeaders } from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = createStripeClient();
    const { payment_intent_id, reason } = await req.json();

    console.log('[CANCEL-PAYMENT-INTENT] Canceling payment intent:', payment_intent_id);

    // Cancel the payment intent
    const canceledIntent = await stripe.paymentIntents.cancel(payment_intent_id, {
      cancellation_reason: 'abandoned',
    });

    console.log('[CANCEL-PAYMENT-INTENT] Successfully canceled:', canceledIntent.id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent_id: canceledIntent.id,
        status: canceledIntent.status,
        reason
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CANCEL-PAYMENT-INTENT] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to cancel payment intent'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
