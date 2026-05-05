import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, refreshStripeMode } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

/**
 * Unified Payment Authorization — Thin proxy to payment-engine authorize action.
 * No direct Stripe calls. All Stripe operations delegated to payment-engine.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Hydrate Stripe mode (test/live) from app_settings before any Stripe call.
  await refreshStripeMode();

  try {
    const supabase = getSupabaseClient();
    const payload = await req.json();
    
    const {
      bookingId,
      customerEmail,
      customerName,
      paymentMethodId,
      tip = 0,
    } = payload;

    console.log('[UNIFIED-AUTH] Delegating to payment-engine authorize:', { bookingId, hasPaymentMethod: !!paymentMethodId });

    if (!bookingId || !customerEmail || !paymentMethodId) {
      throw new Error('Missing required fields');
    }

    // Delegate to payment-engine
    const { data: engineResult, error: engineError } = await supabase.functions.invoke('payment-engine', {
      body: {
        action: 'authorize',
        bookingId,
        paymentMethodId,
        customerEmail,
        customerName,
        tip: Number(tip) || 0,
      },
    });

    if (engineError) {
      console.error('[UNIFIED-AUTH] Engine error:', engineError);
      throw new Error(engineError.message || 'Payment engine error');
    }

    // Forward structured Stripe card errors to the client (HTTP 200 +
    // success:false) so the UI can map error.code to a friendly message
    // instead of seeing a generic "non-2xx" failure.
    if (engineResult && engineResult.success === false && engineResult.stripe_error) {
      return new Response(
        JSON.stringify(engineResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!engineResult?.success) {
      throw new Error(engineResult?.error || 'Payment authorization failed');
    }

    return new Response(
      JSON.stringify(engineResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[UNIFIED-AUTH] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Payment authorization failed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
