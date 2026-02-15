import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

/**
 * Charge Saved Payment Method — Thin proxy to payment-engine charge-difference.
 * No direct Stripe calls.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { bookingId } = await req.json();

    if (!bookingId) throw new Error('bookingId is required');

    console.log('[CHARGE-SAVED] Delegating to payment-engine charge-difference:', bookingId);

    const { data: engineResult, error: engineError } = await supabase.functions.invoke('payment-engine', {
      body: {
        action: 'charge-difference',
        bookingId,
      },
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    });

    if (engineError) {
      throw new Error(engineError.message || 'Failed to charge payment method');
    }

    if (!engineResult?.success) {
      throw new Error(engineResult?.error || 'Failed to charge payment method');
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent_id: engineResult.payment_intent_id,
        status: 'succeeded',
        amount: engineResult.additional_amount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CHARGE-SAVED] Error:', error);
    
    let errorMessage = 'Failed to charge payment method';
    if (error.type === 'StripeCardError') {
      errorMessage = 'Card was declined. Please update payment method.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
