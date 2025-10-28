import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' }) : null;

    console.log('[CLEANUP-PENDING-BOOKINGS] Starting cleanup process...');

    // Get bookings that will be deleted (for Stripe cancellation)
    const threeHoursAgo = new Date(Date.now() - 180 * 60 * 1000).toISOString();
    const { data: expiredBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, stripe_payment_intent_id, created_at')
      .eq('status', 'payment_pending')
      .lt('created_at', threeHoursAgo);

    if (fetchError) {
      throw new Error(`Failed to fetch expired bookings: ${fetchError.message}`);
    }

    console.log(`[CLEANUP-PENDING-BOOKINGS] Found ${expiredBookings?.length || 0} expired bookings`);

    // Cancel Stripe PaymentIntents if they exist
    let canceledIntents = 0;
    if (stripe && expiredBookings && expiredBookings.length > 0) {
      for (const booking of expiredBookings) {
        if (booking.stripe_payment_intent_id) {
          try {
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id, {
              cancellation_reason: 'abandoned',
            });
            canceledIntents++;
            console.log(`[CLEANUP-PENDING-BOOKINGS] Canceled PaymentIntent: ${booking.stripe_payment_intent_id}`);
          } catch (stripeError: any) {
            // If already canceled or doesn't exist, that's fine
            if (stripeError.code !== 'payment_intent_unexpected_state') {
              console.error(`[CLEANUP-PENDING-BOOKINGS] Error canceling PaymentIntent ${booking.stripe_payment_intent_id}:`, stripeError.message);
            }
          }
        }
      }
    }

    // Call the SQL function to cleanup bookings
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('cleanup_expired_pending_bookings', { grace_period_minutes: 180 });

    if (cleanupError) {
      throw new Error(`Cleanup function failed: ${cleanupError.message}`);
    }

    const deletedCount = cleanupResult?.length || 0;
    console.log(`[CLEANUP-PENDING-BOOKINGS] Deleted ${deletedCount} bookings`);

    // Log cleanup to sms_logs for audit trail
    await supabase.from('sms_logs').insert({
      phone_number: 'SYSTEM',
      message: `Automated cleanup: Removed ${deletedCount} expired payment_pending bookings (older than 3 hours). Canceled ${canceledIntents} Stripe PaymentIntents.`,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedCount,
        canceled_intents: canceledIntents,
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
