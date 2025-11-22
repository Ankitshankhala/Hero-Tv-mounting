import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createStripeClient, corsHeaders } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

/**
 * Async Payment Sync Function
 * Handles payment status synchronization in the background
 * Reduces blocking time by moving verification to async processing
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paymentIntentId, bookingId } = await req.json();

    if (!paymentIntentId || !bookingId) {
      throw new Error('Missing required fields: paymentIntentId, bookingId');
    }

    console.log('[ASYNC-SYNC] Starting background sync:', { paymentIntentId, bookingId });

    const stripe = createStripeClient();
    const supabase = getSupabaseClient();

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    console.log('[ASYNC-SYNC] Stripe status:', paymentIntent.status);

    // Map Stripe status to our transaction status
    let transactionStatus = 'pending';
    if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded') {
      transactionStatus = 'authorized';
    } else if (paymentIntent.status === 'canceled') {
      transactionStatus = 'cancelled';
    } else if (paymentIntent.status === 'requires_payment_method') {
      transactionStatus = 'failed';
    }

    // Background synchronization (non-blocking)
    EdgeRuntime.waitUntil(
      Promise.all([
        // Update transaction status
        supabase
          .from('transactions')
          .update({ status: transactionStatus })
          .eq('payment_intent_id', paymentIntentId),
        
        // Update booking payment status
        supabase
          .from('bookings')
          .update({ payment_status: transactionStatus })
          .eq('id', bookingId),
        
        // Log sync operation
        supabase.from('booking_audit_log').insert({
          booking_id: bookingId,
          operation: 'payment_status_sync',
          status: 'success',
          payment_intent_id: paymentIntentId,
          details: {
            stripe_status: paymentIntent.status,
            transaction_status: transactionStatus,
            synced_at: new Date().toISOString()
          }
        })
      ]).catch(error => {
        console.error('[ASYNC-SYNC] Background update error:', error);
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        status: transactionStatus,
        stripe_status: paymentIntent.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ASYNC-SYNC] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Sync failed'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
