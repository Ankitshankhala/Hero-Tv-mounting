import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';
import { corsHeaders, refreshStripeMode } from '../_shared/stripe.ts';
// redeploy: npm: supabase-js import fix (esm.sh ws incompatibility)

/**
 * Detect Uncaptured Payments — Daily monitoring function.
 * Finds bookings with authorized-but-uncaptured payments past their service date
 * and creates admin alerts. Does NOT auto-capture.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Hydrate Stripe mode (test/live) from app_settings before any Stripe call.
  await refreshStripeMode();

  try {
    const supabase = getSupabaseClient();

    console.log('[DETECT-UNCAPTURED] Running daily check...');

    // Find bookings with authorized payments that are past service date and uncaptured
    const { data: stuckBookings, error } = await supabase
      .from('bookings')
      .select(`
        id, payment_intent_id, payment_status, status, scheduled_date,
        authorized_amount, captured_amount, customer_id,
        guest_customer_info
      `)
      .eq('payment_status', 'authorized')
      .eq('payment_flow', 'authorize_at_booking')
      .in('status', ['completed', 'confirmed'])
      .is('captured_amount', null)
      .lt('scheduled_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (error) {
      console.error('[DETECT-UNCAPTURED] Query error:', error);
      throw new Error('Failed to query uncaptured bookings');
    }

    if (!stuckBookings || stuckBookings.length === 0) {
      console.log('[DETECT-UNCAPTURED] No uncaptured payments found');
      return new Response(
        JSON.stringify({ success: true, alerts_created: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[DETECT-UNCAPTURED] Found ${stuckBookings.length} uncaptured booking(s)`);

    // Check for existing unresolved alerts to avoid duplicates
    const bookingIds = stuckBookings.map(b => b.id);
    const { data: existingAlerts } = await supabase
      .from('admin_alerts')
      .select('booking_id')
      .eq('alert_type', 'uncaptured_payment')
      .eq('resolved', false)
      .in('booking_id', bookingIds);

    const existingAlertBookingIds = new Set(existingAlerts?.map(a => a.booking_id) || []);

    // Create alerts for new uncaptured bookings only
    const newAlerts = stuckBookings
      .filter(b => !existingAlertBookingIds.has(b.id))
      .map(b => {
        const customerName = b.guest_customer_info?.name || 'Unknown';
        return {
          alert_type: 'uncaptured_payment',
          severity: 'high',
          booking_id: b.id,
          message: `Uncaptured payment: Booking ${b.id.slice(0, 8)} (${customerName}) has $${b.authorized_amount?.toFixed(2) || '?'} authorized but not captured. Service date: ${b.scheduled_date}. PI: ${b.payment_intent_id}`,
          details: {
            payment_intent_id: b.payment_intent_id,
            authorized_amount: b.authorized_amount,
            scheduled_date: b.scheduled_date,
            booking_status: b.status,
          },
        };
      });

    if (newAlerts.length > 0) {
      const { error: insertError } = await supabase
        .from('admin_alerts')
        .insert(newAlerts);

      if (insertError) {
        console.error('[DETECT-UNCAPTURED] Failed to create alerts:', insertError);
      } else {
        console.log(`[DETECT-UNCAPTURED] Created ${newAlerts.length} alert(s)`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_uncaptured: stuckBookings.length,
        alerts_created: newAlerts.length,
        skipped_existing: existingAlertBookingIds.size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[DETECT-UNCAPTURED] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
