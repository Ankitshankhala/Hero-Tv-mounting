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

    console.log('[BULK-DELETE-PAYMENT-PENDING] Starting bulk deletion...');

    // Fetch all payment_pending bookings
    const { data: pendingBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, payment_intent_id, created_at')
      .eq('status', 'payment_pending');

    if (fetchError) {
      throw new Error(`Failed to fetch payment_pending bookings: ${fetchError.message}`);
    }

    console.log(`[BULK-DELETE-PAYMENT-PENDING] Found ${pendingBookings?.length || 0} payment_pending bookings`);

    if (!pendingBookings || pendingBookings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          deleted_count: 0,
          canceled_intents: 0,
          message: 'No payment_pending bookings found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cancel Stripe PaymentIntents if they exist
    let canceledIntents = 0;
    if (stripe) {
      for (const booking of pendingBookings) {
        if (booking.payment_intent_id) {
          try {
            await stripe.paymentIntents.cancel(booking.payment_intent_id, {
              cancellation_reason: 'abandoned',
            });
            canceledIntents++;
            console.log(`[BULK-DELETE-PAYMENT-PENDING] Canceled PaymentIntent: ${booking.payment_intent_id}`);
          } catch (stripeError: any) {
            // If already canceled or in a state that can't be canceled, continue
            if (stripeError.code !== 'payment_intent_unexpected_state') {
              console.error(`[BULK-DELETE-PAYMENT-PENDING] Error canceling PaymentIntent ${booking.payment_intent_id}:`, stripeError.message);
            }
          }
        }
      }
    }

    // Delete each booking using the cascade function
    const deletedBookingIds: string[] = [];
    const failedBookingIds: string[] = [];

    for (const booking of pendingBookings) {
      try {
        const { error: deleteError } = await supabase
          .rpc('delete_booking_with_cascade', { p_booking_id: booking.id });

        if (deleteError) {
          console.error(`[BULK-DELETE-PAYMENT-PENDING] Failed to delete booking ${booking.id}:`, deleteError.message);
          failedBookingIds.push(booking.id);
        } else {
          deletedBookingIds.push(booking.id);
          console.log(`[BULK-DELETE-PAYMENT-PENDING] Deleted booking: ${booking.id}`);
        }
      } catch (err: any) {
        console.error(`[BULK-DELETE-PAYMENT-PENDING] Exception deleting booking ${booking.id}:`, err.message);
        failedBookingIds.push(booking.id);
      }
    }

    console.log(`[BULK-DELETE-PAYMENT-PENDING] Completed: ${deletedBookingIds.length} deleted, ${failedBookingIds.length} failed`);

    // Log cleanup to sms_logs for audit trail
    await supabase.from('sms_logs').insert({
      recipient_number: 'SYSTEM',
      message: `Bulk delete: Removed ${deletedBookingIds.length} payment_pending bookings. Canceled ${canceledIntents} Stripe PaymentIntents. Failed: ${failedBookingIds.length}`,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedBookingIds.length,
        canceled_intents: canceledIntents,
        failed_count: failedBookingIds.length,
        deleted_booking_ids: deletedBookingIds,
        failed_booking_ids: failedBookingIds,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[BULK-DELETE-PAYMENT-PENDING] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to delete payment_pending bookings',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
