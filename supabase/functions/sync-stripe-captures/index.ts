import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[SYNC-STRIPE-CAPTURES] Starting Stripe capture sync...');
    
    const { since_days = 45 } = await req.json().catch(() => ({ since_days: 45 }));

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing STRIPE_SECRET_KEY' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const sinceTs = Math.floor((Date.now() - since_days * 24 * 60 * 60 * 1000) / 1000);

    let hasMore = true;
    let startingAfter: string | undefined = undefined;
    let synced = 0;
    let skipped = 0;
    const errors: Array<{ booking_id: string; error: string }> = [];

    while (hasMore) {
      const params = new URLSearchParams({ limit: '100', 'created[gte]': String(sinceTs) });
      if (startingAfter) params.set('starting_after', startingAfter);

      const resp = await fetch(`https://api.stripe.com/v1/charges?${params.toString()}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Stripe API error: ${err}`);
      }

      const data = await resp.json();

      for (const charge of data.data ?? []) {
        if (charge.status !== 'succeeded' || charge.refunded) {
          skipped++;
          continue;
        }

        const payment_intent_id: string | null = charge.payment_intent || null;
        if (!payment_intent_id) {
          skipped++;
          continue;
        }

        const amount = (charge.amount_captured ?? charge.amount ?? 0) / 100.0;
        const created_at = new Date((charge.created ?? Date.now() / 1000) * 1000).toISOString();
        const currency = String(charge.currency ?? 'usd').toUpperCase();
        const guest_email = charge.billing_details?.email || charge.receipt_email || null;

        // Check for existing capture
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('payment_intent_id', payment_intent_id)
          .eq('transaction_type', 'capture')
          .eq('status', 'completed')
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Find linked booking
        const { data: booking } = await supabase
          .from('bookings')
          .select('id')
          .eq('payment_intent_id', payment_intent_id)
          .maybeSingle();

        const insertPayload = {
          booking_id: booking?.id ?? null,
          amount,
          status: 'completed',
          currency,
          transaction_type: 'capture',
          payment_intent_id,
          payment_method: charge.payment_method_details?.type ?? null,
          guest_customer_email: guest_email,
          created_at,
        };

        const { error: insErr } = await supabase.from('transactions').insert(insertPayload);
        
        if (insErr) {
          errors.push({ 
            booking_id: booking?.id || 'unknown', 
            error: insErr.message 
          });
        } else {
          synced++;
        }
      }

      hasMore = Boolean(data.has_more);
      startingAfter = hasMore ? data.data[data.data.length - 1]?.id : undefined;
    }

    console.log(`[SYNC-STRIPE-CAPTURES] Complete. Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      synced,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[SYNC-STRIPE-CAPTURES] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
