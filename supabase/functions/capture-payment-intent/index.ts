import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/stripe.ts';

/**
 * Capture Payment Intent — Thin proxy to payment-engine capture action.
 * No direct Stripe calls. Rejects mismatched totals (forces recalculate first).
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { booking_id } = await req.json();

    if (!booking_id) throw new Error('booking_id is required');

    console.log('[CAPTURE-PAYMENT] Delegating to payment-engine capture:', booking_id);

    // Delegate to payment-engine
    const { data: engineResult, error: engineError } = await supabase.functions.invoke('payment-engine', {
      body: {
        action: 'capture',
        bookingId: booking_id,
      },
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    });

    if (engineError) {
      console.error('[CAPTURE-PAYMENT] Engine error:', engineError);
      throw new Error(engineError.message || 'Payment capture failed');
    }

    if (!engineResult?.success) {
      throw new Error(engineResult?.error || 'Payment capture failed');
    }

    console.log('[CAPTURE-PAYMENT] Captured successfully:', engineResult.amount_captured);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: engineResult.transaction_id,
        amount_captured: engineResult.amount_captured,
        payment_intent_id: engineResult.payment_intent_id,
        message: 'Payment captured successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CAPTURE-PAYMENT] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Payment capture failed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
