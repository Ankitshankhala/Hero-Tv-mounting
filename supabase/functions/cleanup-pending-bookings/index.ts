import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { getStripeMode, refreshStripeMode } from "../_shared/stripe.ts";
// redeploy: npm: supabase-js import fix (esm.sh ws incompatibility)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Hydrate Stripe mode (test/live) from app_settings before any Stripe call.
  await refreshStripeMode();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mode = getStripeMode();
    const stripeSecretKey =
      mode === 'test'
        ? Deno.env.get('STRIPE_SECRET_KEY_TEST')
        : Deno.env.get('STRIPE_SECRET_KEY');
    console.log(`[CLEANUP-PENDING-BOOKINGS] Stripe mode: ${mode}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' }) : null;

    console.log('[CLEANUP-PENDING-BOOKINGS] Starting cleanup process...');

    // Get bookings that will be deleted (for Stripe cancellation)
    const threeHoursAgo = new Date(Date.now() - 180 * 60 * 1000).toISOString();
    const { data: expiredBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, payment_intent_id, created_at')
      .eq('status', 'payment_pending')
      .lt('created_at', threeHoursAgo);

    if (fetchError) {
      throw new Error(`Failed to fetch expired bookings: ${fetchError.message}`);
    }

    console.log(`[CLEANUP-PENDING-BOOKINGS] Found ${expiredBookings?.length || 0} expired bookings`);

    // For each expired booking with a PI, check Stripe state FIRST.
    // If Stripe shows the payment is actually live (requires_capture / succeeded / processing),
    // rescue the booking out of the delete path and raise an admin alert. Otherwise cancel the PI.
    let canceledIntents = 0;
    let rescuedCount = 0;
    const rescuedIds: string[] = [];

    if (stripe && expiredBookings && expiredBookings.length > 0) {
      for (const booking of expiredBookings) {
        if (!booking.payment_intent_id) continue;

        let pi: any = null;
        try {
          pi = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        } catch (retrieveErr: any) {
          console.error(
            `[CLEANUP-PENDING-BOOKINGS] Failed to retrieve PI ${booking.payment_intent_id}:`,
            retrieveErr.message
          );
          // If we cannot verify PI state, fall through to cancel attempt (existing behavior).
        }

        const liveStatuses = new Set(['requires_capture', 'succeeded', 'processing']);
        if (pi && liveStatuses.has(pi.status)) {
          // RESCUE: payment_pending row has a live/paid PI at Stripe. Do not cancel, do not delete.
          const authorizedAmount = (pi.amount || 0) / 100;
          const capturedAmount =
            pi.status === 'succeeded'
              ? (pi.amount_received || pi.amount || 0) / 100
              : null;
          const paymentStatus = pi.status === 'succeeded' ? 'captured' : 'authorized';
          const nowIso = new Date().toISOString();

          const { error: rescueErr } = await supabase
            .from('bookings')
            .update({
              status: 'pending',
              payment_status: paymentStatus,
              authorized_amount: authorizedAmount,
              captured_amount: capturedAmount,
              updated_at: nowIso,
            })
            .eq('id', booking.id);

          if (rescueErr) {
            console.error(
              `[CLEANUP-PENDING-BOOKINGS] Failed to rescue booking ${booking.id}:`,
              rescueErr.message
            );
            continue;
          }

          await supabase.from('admin_alerts').insert({
            alert_type: 'pending_booking_desync',
            severity: 'high',
            booking_id: booking.id,
            message: `Booking ${booking.id} was payment_pending but Stripe PI ${pi.id} is ${pi.status} ($${authorizedAmount.toFixed(2)}). Rescued from cleanup delete.`,
            details: {
              pi_status: pi.status,
              payment_intent_id: pi.id,
              amount: authorizedAmount,
              amount_received: (pi.amount_received || 0) / 100,
            },
          });

          rescuedCount++;
          rescuedIds.push(booking.id);
          console.log(`[CLEANUP-PENDING-BOOKINGS] Rescued booking ${booking.id} (PI ${pi.id} status=${pi.status})`);
          continue;
        }

        // Cancellable PI — existing behavior.
        try {
          await stripe.paymentIntents.cancel(booking.payment_intent_id, {
            cancellation_reason: 'abandoned',
          });
          canceledIntents++;
          console.log(`[CLEANUP-PENDING-BOOKINGS] Canceled PaymentIntent: ${booking.payment_intent_id}`);
        } catch (stripeError: any) {
          if (stripeError.code !== 'payment_intent_unexpected_state') {
            console.error(`[CLEANUP-PENDING-BOOKINGS] Error canceling PaymentIntent ${booking.payment_intent_id}:`, stripeError.message);
          }
        }
      }
    }

    // Call the SQL function to cleanup bookings.
    // Rescued rows are already moved out of 'payment_pending' so the RPC will not touch them.
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('cleanup_expired_pending_bookings', { grace_period_minutes: 180 });

    if (cleanupError) {
      throw new Error(`Cleanup function failed: ${cleanupError.message}`);
    }

    const deletedCount = cleanupResult?.length || 0;
    console.log(`[CLEANUP-PENDING-BOOKINGS] Deleted ${deletedCount} bookings, rescued ${rescuedCount}`);

    // Log cleanup to sms_logs for audit trail
    await supabase.from('sms_logs').insert({
      recipient_number: 'SYSTEM',
      message: `Automated cleanup: Removed ${deletedCount} expired payment_pending bookings (older than 3 hours). Canceled ${canceledIntents} Stripe PaymentIntents. Rescued ${rescuedCount} desync'd bookings.`,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedCount,
        canceled_intents: canceledIntents,
        rescued_count: rescuedCount,
        rescued_booking_ids: rescuedIds,
        booking_ids: cleanupResult?.map((b: any) => b.id) || [],
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CLEANUP-PENDING-BOOKINGS] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to cleanup pending bookings',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
