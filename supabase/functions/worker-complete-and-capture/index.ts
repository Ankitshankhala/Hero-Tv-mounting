import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';
import { corsHeaders, refreshStripeMode } from '../_shared/stripe.ts';

/**
 * Worker Complete & Capture — single-purpose endpoint for the worker UI.
 * Thin wrapper that delegates to payment-engine action `complete-and-capture`.
 * The engine atomically captures the authorized payment, marks the booking
 * completed, and archives it. The worker UI must NEVER mutate booking status
 * directly — it calls this function only.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Hydrate Stripe mode (test/live) from app_settings before any Stripe call.
  await refreshStripeMode();

  try {
    const supabase = getSupabaseClient();
    const { booking_id } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log('[WORKER-COMPLETE-AND-CAPTURE] Delegating to payment-engine:', booking_id);

    const { data, error } = await supabase.functions.invoke('payment-engine', {
      body: {
        action: 'complete-and-capture',
        bookingId: booking_id,
      },
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    });

    if (error) {
      const err: any = error as any;
      const msg = err?.context?.error || err?.message || 'Failed to complete job and capture payment';
      throw new Error(msg);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to complete job and capture payment');
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[WORKER-COMPLETE-AND-CAPTURE] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to complete job and capture payment',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
