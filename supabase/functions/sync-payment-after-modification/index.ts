import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

/**
 * Sync Payment After Modification — Thin proxy to payment-engine recalculate.
 * No direct Stripe calls.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { booking_id, modification_reason } = await req.json();

    if (!booking_id) throw new Error('booking_id is required');

    console.log('[SYNC-PAYMENT] Delegating to payment-engine recalculate:', booking_id);

    const { data: engineResult, error: engineError } = await supabase.functions.invoke('payment-engine', {
      body: {
        action: 'recalculate',
        bookingId: booking_id,
        modification_reason: modification_reason || 'sync_payment',
      },
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    });

    if (engineError) {
      console.error('[SYNC-PAYMENT] Engine error:', engineError);
      throw new Error(engineError.message || 'Payment sync failed');
    }

    return new Response(
      JSON.stringify(engineResult || { success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SYNC-PAYMENT] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Payment sync failed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
