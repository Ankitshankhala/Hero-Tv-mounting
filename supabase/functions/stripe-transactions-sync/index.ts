// Supabase Edge Function: stripe-transactions-sync
// Sync recent Stripe charges into the public.transactions table
// Requires secret: STRIPE_SECRET_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders } });
  }

  try {
    const { since_days = 45 } = await req.json().catch(() => ({ since_days: 45 }));

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Missing STRIPE_SECRET_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const sinceTs = Math.floor((Date.now() - since_days * 24 * 60 * 60 * 1000) / 1000);

    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    const imported: Array<{ payment_intent_id: string; amount: number }> = [];

    while (hasMore) {
      const params = new URLSearchParams({ limit: "100", "created[gte]": String(sinceTs) });
      if (startingAfter) params.set("starting_after", startingAfter);

      const resp = await fetch(`https://api.stripe.com/v1/charges?${params.toString()}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      });
      if (!resp.ok) {
        const err = await resp.text();
        return new Response(JSON.stringify({ error: "Stripe API error", details: err }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const data = await resp.json();

      for (const charge of data.data ?? []) {
        // Only consider succeeded & captured charges (actual revenue)
        if (charge.status !== "succeeded" || charge.refunded) continue;

        const payment_intent_id: string | null = charge.payment_intent || null;
        if (!payment_intent_id) continue;

        const amount = (charge.amount_captured ?? charge.amount ?? 0) / 100.0;
        const created_at = new Date((charge.created ?? Date.now() / 1000) * 1000).toISOString();
        const currency = String(charge.currency ?? "usd").toUpperCase();
        const guest_email = charge.billing_details?.email || charge.receipt_email || null;

        // Skip if we already have a completed capture for this PI
        const { data: existing, error: existErr } = await supabase
          .from("transactions")
          .select("id")
          .eq("payment_intent_id", payment_intent_id)
          .eq("transaction_type", "capture")
          .eq("status", "completed")
          .maybeSingle();
        if (existErr) {
          console.error("existErr", existErr);
        }
        if (existing) continue;

        // Try to link to a booking by payment_intent_id
        const { data: booking, error: bkErr } = await supabase
          .from("bookings")
          .select("id")
          .eq("payment_intent_id", payment_intent_id)
          .maybeSingle();
        if (bkErr) {
          console.error("booking lookup error", bkErr);
        }

        const insertPayload: any = {
          booking_id: booking?.id ?? null,
          amount,
          status: "completed",
          currency,
          transaction_type: "capture",
          payment_intent_id,
          payment_method: charge.payment_method_details?.type ?? null,
          guest_customer_email: guest_email,
          created_at,
        };

        const { error: insErr } = await supabase.from("transactions").insert(insertPayload);
        if (insErr) {
          console.error("insert error", insErr, insertPayload);
        } else {
          imported.push({ payment_intent_id, amount });
        }
      }

      hasMore = Boolean(data.has_more);
      startingAfter = hasMore ? data.data[data.data.length - 1]?.id : undefined;
    }

    return new Response(
      JSON.stringify({ success: true, imported_count: imported.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});