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

    const body = await req.json().catch(() => ({}));
    const { payment_intent_id, booking_id, since_days = 45 } = body;

    // INDIVIDUAL SYNC MODE: sync a single payment by payment_intent_id or booking_id
    if (payment_intent_id || booking_id) {
      console.log('[SYNC-STRIPE-CAPTURES] Individual sync mode:', { payment_intent_id, booking_id });
      
      let piId = payment_intent_id;
      
      // If only booking_id provided, fetch payment_intent_id from booking
      if (!piId && booking_id) {
        const { data: booking } = await supabase
          .from('bookings')
          .select('payment_intent_id')
          .eq('id', booking_id)
          .maybeSingle();
        
        if (!booking?.payment_intent_id) {
          // Try transactions table
          const { data: txn } = await supabase
            .from('transactions')
            .select('payment_intent_id')
            .eq('booking_id', booking_id)
            .not('payment_intent_id', 'is', null)
            .limit(1)
            .maybeSingle();
          
          piId = txn?.payment_intent_id;
        } else {
          piId = booking.payment_intent_id;
        }
      }

      if (!piId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No payment_intent_id found'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch PaymentIntent from Stripe
      const piResp = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      });

      if (!piResp.ok) {
        const err = await piResp.text();
        throw new Error(`Stripe API error: ${err}`);
      }

      const pi = await piResp.json();
      console.log('[SYNC-STRIPE-CAPTURES] PaymentIntent status:', pi.status);

      // Map Stripe status to our statuses
      let dbPaymentStatus: string;
      let transactionStatus: string;
      let transactionType: string;

      switch (pi.status) {
        case 'succeeded':
          dbPaymentStatus = 'captured';
          transactionStatus = 'completed';
          transactionType = 'capture';
          break;
        case 'requires_capture':
          dbPaymentStatus = 'authorized';
          transactionStatus = 'authorized';
          transactionType = 'authorization';
          break;
        case 'canceled':
          dbPaymentStatus = 'cancelled';
          transactionStatus = 'cancelled';
          transactionType = 'cancellation';
          break;
        case 'requires_payment_method':
        case 'requires_confirmation':
        case 'requires_action':
          dbPaymentStatus = 'pending';
          transactionStatus = 'pending';
          transactionType = 'charge';
          break;
        default:
          dbPaymentStatus = 'pending';
          transactionStatus = 'pending';
          transactionType = 'charge';
      }

      const amount = (pi.amount_received || pi.amount || 0) / 100;
      const updates: string[] = [];

      // Update booking
      const { data: updatedBooking, error: bookingErr } = await supabase
        .from('bookings')
        .update({ 
          payment_status: dbPaymentStatus,
          is_archived: dbPaymentStatus === 'captured' ? false : undefined,
          archived_at: dbPaymentStatus === 'captured' ? null : undefined,
        })
        .eq('payment_intent_id', piId)
        .select('id')
        .maybeSingle();

      if (updatedBooking) {
        updates.push(`Booking ${updatedBooking.id} → ${dbPaymentStatus}`);
      }

      // Update or insert transaction
      const { data: existingTxn } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('payment_intent_id', piId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingTxn) {
        await supabase
          .from('transactions')
          .update({ 
            status: transactionStatus,
            transaction_type: transactionType,
            amount,
          })
          .eq('id', existingTxn.id);
        updates.push(`Transaction ${existingTxn.id} → ${transactionStatus}`);
      } else if (updatedBooking && pi.status === 'succeeded') {
        // Insert new capture transaction if none exists
        const guest_email = pi.receipt_email || pi.metadata?.customer_email || null;
        await supabase.from('transactions').insert({
          booking_id: updatedBooking.id,
          amount,
          status: 'completed',
          currency: (pi.currency || 'usd').toUpperCase(),
          transaction_type: 'capture',
          payment_intent_id: piId,
          payment_method: pi.payment_method_types?.[0] || null,
          guest_customer_email: guest_email,
        });
        updates.push('Created new capture transaction');
      }

      // Add audit log
      await supabase.from('booking_audit_log').insert({
        booking_id: updatedBooking?.id || null,
        payment_intent_id: piId,
        operation: 'stripe_sync',
        status: 'success',
        details: { stripe_status: pi.status, db_status: dbPaymentStatus, updates },
      });

      console.log('[SYNC-STRIPE-CAPTURES] Individual sync complete:', updates);

      return new Response(JSON.stringify({
        success: true,
        mode: 'individual',
        stripe_status: pi.status,
        db_status: dbPaymentStatus,
        updates,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // BULK SYNC MODE: sync all captures from last N days
    console.log('[SYNC-STRIPE-CAPTURES] Bulk sync mode, since_days:', since_days);
    
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

        const pi_id: string | null = charge.payment_intent || null;
        if (!pi_id) {
          skipped++;
          continue;
        }

        const chargeAmount = (charge.amount_captured ?? charge.amount ?? 0) / 100.0;
        const created_at = new Date((charge.created ?? Date.now() / 1000) * 1000).toISOString();
        const currency = String(charge.currency ?? 'usd').toUpperCase();
        const guest_email = charge.billing_details?.email || charge.receipt_email || null;

        // Check for existing capture
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('payment_intent_id', pi_id)
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
          .eq('payment_intent_id', pi_id)
          .maybeSingle();

        const insertPayload = {
          booking_id: booking?.id ?? null,
          amount: chargeAmount,
          status: 'completed',
          currency,
          transaction_type: 'capture',
          payment_intent_id: pi_id,
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

    console.log(`[SYNC-STRIPE-CAPTURES] Bulk sync complete. Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      mode: 'bulk',
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
