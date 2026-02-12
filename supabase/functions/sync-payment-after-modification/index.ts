import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createStripeClient, corsHeaders } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

/**
 * Sync Payment After Modification
 * 
 * When worker modifies services (add/remove/change quantity), the DB total
 * changes but the Stripe PaymentIntent amount stays the same.
 * 
 * This function:
 * 1. Calculates the true total from booking_services (server-side)
 * 2. Compares against the current Stripe PaymentIntent amount
 * 3. If different and PI is requires_capture:
 *    a. Cancel old PI
 *    b. Create new PI with same customer/payment method, manual capture, confirm: true
 *    c. Update booking.payment_intent_id (synchronous)
 * 4. If PI is succeeded (already captured):
 *    - Increase: create separate charge for difference
 *    - Decrease: issue partial refund
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = createStripeClient();
    const supabase = getSupabaseClient();

    const { booking_id, modification_reason } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log('[SYNC-PAYMENT] Starting sync for booking:', booking_id, 'reason:', modification_reason);

    // Fetch booking + services in parallel
    const [bookingResult, servicesResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, payment_intent_id, stripe_customer_id, stripe_payment_method_id, tip_amount, payment_status')
        .eq('id', booking_id)
        .single(),
      supabase
        .from('booking_services')
        .select('base_price, quantity')
        .eq('booking_id', booking_id)
    ]);

    if (bookingResult.error || !bookingResult.data) {
      throw new Error('Booking not found');
    }
    if (servicesResult.error) {
      throw new Error('Failed to fetch booking services');
    }

    const booking = bookingResult.data;

    if (!booking.payment_intent_id) {
      console.log('[SYNC-PAYMENT] No payment_intent_id on booking, nothing to sync');
      return new Response(
        JSON.stringify({ success: true, action: 'no_op', reason: 'no_payment_intent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate server-side total
    const servicesTotal = (servicesResult.data || []).reduce((sum, s) => {
      return sum + (Number(s.base_price) * s.quantity);
    }, 0);
    const tipAmount = Number(booking.tip_amount) || 0;
    const newTotal = servicesTotal + tipAmount;
    const newTotalCents = Math.round(newTotal * 100);

    // Retrieve current PaymentIntent from Stripe
    const currentPI = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

    console.log('[SYNC-PAYMENT] Comparison:', {
      stripe_amount_cents: currentPI.amount,
      db_total_cents: newTotalCents,
      stripe_status: currentPI.status,
      difference_cents: newTotalCents - currentPI.amount
    });

    // If amounts match, no-op
    if (Math.abs(currentPI.amount - newTotalCents) <= 1) {
      console.log('[SYNC-PAYMENT] Amounts match, no sync needed');
      return new Response(
        JSON.stringify({ success: true, action: 'no_op', reason: 'amounts_match' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for saved payment method
    if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
      console.warn('[SYNC-PAYMENT] No saved payment method — cannot auto-reauthorize');
      
      await supabase.from('bookings').update({
        pending_payment_amount: newTotal,
        has_modifications: true,
      }).eq('id', booking_id);

      await supabase.from('booking_audit_log').insert({
        booking_id,
        operation: 'payment_sync_skipped',
        status: 'warning',
        payment_intent_id: booking.payment_intent_id,
        details: {
          reason: 'no_saved_payment_method',
          stripe_amount: currentPI.amount / 100,
          db_total: newTotal,
          modification_reason,
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          action: 'requires_manual_payment',
          requires_manual_payment: true,
          stripe_amount: currentPI.amount / 100,
          db_total: newTotal,
          difference: (newTotalCents - currentPI.amount) / 100,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Handle based on PI status ---

    if (currentPI.status === 'requires_capture') {
      // PRE-CAPTURE: Cancel old PI, create new PI
      console.log('[SYNC-PAYMENT] PI is requires_capture — cancel and recreate');

      const idempotencyKey = `sync_${booking_id}_${newTotalCents}`;

      // Step 1: Create new PI with saved payment method
      const newPI = await stripe.paymentIntents.create({
        amount: newTotalCents,
        currency: 'usd',
        customer: booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        capture_method: 'manual',
        confirm: true,
        off_session: true,
        metadata: {
          booking_id,
          original_payment_intent: booking.payment_intent_id,
          reason: modification_reason || 'service_modification',
        }
      }, {
        idempotencyKey,
      });

      console.log('[SYNC-PAYMENT] New PI created:', {
        id: newPI.id,
        status: newPI.status,
        amount: newPI.amount
      });

      if (newPI.status !== 'requires_capture') {
        throw new Error(`New PaymentIntent has unexpected status: ${newPI.status}`);
      }

      // Step 2: Cancel old PI
      try {
        await stripe.paymentIntents.cancel(booking.payment_intent_id);
        console.log('[SYNC-PAYMENT] Old PI canceled:', booking.payment_intent_id);
      } catch (cancelErr: any) {
        console.warn('[SYNC-PAYMENT] Old PI cancel warning:', cancelErr.message);
      }

      // Step 3: SYNCHRONOUS booking update
      const { error: updateError } = await supabase.from('bookings').update({
        payment_intent_id: newPI.id,
        payment_status: 'authorized',
        pending_payment_amount: null,
        has_modifications: true,
      }).eq('id', booking_id);

      if (updateError) {
        console.error('[SYNC-PAYMENT] CRITICAL: Booking update failed:', updateError);
      }

      // Step 4: Update transaction record
      const { error: txError } = await supabase.from('transactions')
        .update({
          payment_intent_id: newPI.id,
          amount: newTotal,
          base_amount: servicesTotal,
          tip_amount: tipAmount,
        })
        .eq('booking_id', booking_id)
        .eq('status', 'authorized');

      if (txError) {
        console.warn('[SYNC-PAYMENT] Transaction update failed, creating new:', txError);
        await supabase.from('transactions').insert({
          booking_id,
          amount: newTotal,
          base_amount: servicesTotal,
          tip_amount: tipAmount,
          status: 'authorized',
          payment_intent_id: newPI.id,
          transaction_type: 'authorization',
          payment_method: 'card',
        });
      }

      // Step 5: Audit log
      await supabase.from('booking_audit_log').insert({
        booking_id,
        operation: 'payment_synced',
        status: 'success',
        payment_intent_id: newPI.id,
        details: {
          old_payment_intent: booking.payment_intent_id,
          old_amount: currentPI.amount / 100,
          new_amount: newTotal,
          modification_reason,
        }
      });

      // Step 6: Update invoice in background
      EdgeRuntime.waitUntil(
        supabase.functions.invoke('update-invoice', {
          body: { booking_id, send_email: false }
        }).catch(err => console.error('[SYNC-PAYMENT] Invoice update failed:', err))
      );

      return new Response(
        JSON.stringify({
          success: true,
          action: 'reauthorized',
          old_payment_intent_id: booking.payment_intent_id,
          new_payment_intent_id: newPI.id,
          old_amount: currentPI.amount / 100,
          new_amount: newTotal,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (currentPI.status === 'succeeded') {
      // POST-CAPTURE: charge difference or refund
      console.log('[SYNC-PAYMENT] PI is succeeded (already captured)');

      const diffCents = newTotalCents - currentPI.amount;

      if (diffCents > 0) {
        // INCREASE: Create separate charge for difference
        console.log('[SYNC-PAYMENT] Creating additional charge for:', diffCents, 'cents');
        
        const additionalPI = await stripe.paymentIntents.create({
          amount: diffCents,
          currency: 'usd',
          customer: booking.stripe_customer_id,
          payment_method: booking.stripe_payment_method_id,
          confirm: true,
          off_session: true,
          metadata: {
            booking_id,
            reason: 'post_capture_service_addition',
            original_payment_intent: booking.payment_intent_id,
          }
        }, {
          idempotencyKey: `postcap_add_${booking_id}_${diffCents}`,
        });

        console.log('[SYNC-PAYMENT] Additional charge result:', additionalPI.status);

        await supabase.from('transactions').insert({
          booking_id,
          amount: diffCents / 100,
          base_amount: diffCents / 100,
          status: 'completed',
          payment_intent_id: additionalPI.id,
          transaction_type: 'additional_charge',
          payment_method: 'card',
        });

        await supabase.from('booking_audit_log').insert({
          booking_id,
          operation: 'post_capture_additional_charge',
          status: 'success',
          payment_intent_id: additionalPI.id,
          details: {
            additional_amount: diffCents / 100,
            modification_reason,
          }
        });

        return new Response(
          JSON.stringify({
            success: true,
            action: 'additional_charge',
            additional_amount: diffCents / 100,
            payment_intent_id: additionalPI.id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } else {
        // DECREASE: Partial refund
        const refundCents = Math.abs(diffCents);
        console.log('[SYNC-PAYMENT] Creating partial refund for:', refundCents, 'cents');

        const refund = await stripe.refunds.create({
          payment_intent: booking.payment_intent_id,
          amount: refundCents,
        }, {
          idempotencyKey: `postcap_refund_${booking_id}_${refundCents}`,
        });

        await supabase.from('transactions').insert({
          booking_id,
          amount: refundCents / 100,
          status: 'completed',
          payment_intent_id: booking.payment_intent_id,
          stripe_refund_id: refund.id,
          transaction_type: 'partial_refund',
          refund_amount: refundCents / 100,
          payment_method: 'card',
        });

        await supabase.from('booking_audit_log').insert({
          booking_id,
          operation: 'post_capture_partial_refund',
          status: 'success',
          payment_intent_id: booking.payment_intent_id,
          details: {
            refund_amount: refundCents / 100,
            refund_id: refund.id,
            modification_reason,
          }
        });

        return new Response(
          JSON.stringify({
            success: true,
            action: 'partial_refund',
            refund_amount: refundCents / 100,
            refund_id: refund.id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } else {
      // Other statuses (canceled, etc.) — can't sync
      console.warn('[SYNC-PAYMENT] PI status not syncable:', currentPI.status);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Cannot sync payment with status: ${currentPI.status}`,
          requires_manual_payment: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('[SYNC-PAYMENT] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Payment sync failed',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
