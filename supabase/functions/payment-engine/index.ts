import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createStripeClient, corsHeaders } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

/**
 * Payment Engine — Single authoritative Stripe operations handler.
 * 
 * This is the ONLY function allowed to call:
 *   stripe.paymentIntents.create()
 *   stripe.paymentIntents.cancel()
 *   stripe.paymentIntents.capture()
 *   stripe.refunds.create()
 * 
 * Actions: authorize, recalculate, capture, charge-difference, refund-difference
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = createStripeClient();
    const supabase = getSupabaseClient();
    const payload = await req.json();
    const { action } = payload;

    if (!action) {
      throw new Error('action is required');
    }

    console.log(`[PAYMENT-ENGINE] Action: ${action}`, JSON.stringify(payload, null, 2));

    // === Helper: Calculate services total from DB ===
    async function getServicesTotal(bookingId: string) {
      const { data, error } = await supabase
        .from('booking_services')
        .select('base_price, quantity')
        .eq('booking_id', bookingId);
      if (error) throw new Error('Failed to fetch booking services: ' + error.message);
      if (!data || data.length === 0) throw new Error('Booking has no services');
      return data.reduce((sum, s) => sum + (Number(s.base_price) * s.quantity), 0);
    }

    // === Helper: Validate JWT for protected actions ===
    async function validateAuth(authHeader: string | null) {
      if (!authHeader?.startsWith('Bearer ')) {
        throw new Error('Authorization required');
      }
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.50.0");
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace('Bearer ', '');
      const { data, error } = await anonClient.auth.getUser(token);
      if (error || !data?.user) throw new Error('Invalid auth token');
      return data.user.id;
    }

    // === Helper: Verify caller is worker/admin for a booking ===
    async function verifyWorkerOrAdmin(userId: string, bookingId: string) {
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      if (user?.role === 'admin') return;
      const { data: booking } = await supabase
        .from('bookings')
        .select('worker_id')
        .eq('id', bookingId)
        .single();
      if (booking?.worker_id !== userId) {
        throw new Error('Access denied: must be assigned worker or admin');
      }
    }

    // ========== ACTION: AUTHORIZE ==========
    if (action === 'authorize') {
      const { bookingId, paymentMethodId, customerEmail, customerName, tip = 0 } = payload;
      if (!bookingId || !paymentMethodId || !customerEmail) {
        throw new Error('Missing required fields for authorize');
      }

      // Lock booking
      const { data: lockData, error: lockError } = await supabase.rpc('lock_booking_for_payment', {
        p_booking_id: bookingId,
      });
      if (lockError) throw new Error(lockError.message);
      const booking = lockData?.[0];
      if (!booking) throw new Error('Booking not found');

      if (booking.payment_status !== 'payment_pending' && booking.payment_status !== 'pending') {
        throw new Error(`Cannot authorize: booking payment_status is ${booking.payment_status}`);
      }

      // Calculate total from DB
      const servicesTotal = await getServicesTotal(bookingId);
      const tipAmount = Math.max(0, Math.min(Number(tip) || 0, servicesTotal));
      const totalAmount = servicesTotal + tipAmount;
      const totalCents = Math.round(totalAmount * 100);

      console.log('[PAYMENT-ENGINE] authorize:', { servicesTotal, tipAmount, totalAmount });

      // Find or create Stripe customer
      const { data: existingCustomer } = await supabase
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('email', customerEmail)
        .maybeSingle();

      let stripeCustomerId: string;
      if (existingCustomer?.stripe_customer_id) {
        stripeCustomerId = existingCustomer.stripe_customer_id;
        try {
          await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
        } catch (e: any) {
          if (!e.message?.includes('already been attached')) {
            console.warn('[PAYMENT-ENGINE] attach warning:', e.message);
          }
        }
      } else {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName || 'Guest Customer',
        });
        stripeCustomerId = customer.id;
        await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
        await supabase.from('stripe_customers').insert({
          email: customerEmail,
          name: customerName || 'Guest Customer',
          stripe_customer_id: stripeCustomerId,
          stripe_default_payment_method_id: paymentMethodId,
        });
      }

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Create PI
      const idempotencyKey = `authorize_${bookingId}_v${booking.payment_version}`;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: 'usd',
        customer: stripeCustomerId,
        capture_method: 'manual',
        payment_method: paymentMethodId,
        confirm: true,
        return_url: `${Deno.env.get('FRONTEND_URL') || 'https://hero-tv-mounting.lovable.app'}/booking/payment-complete`,
        metadata: {
          booking_id: bookingId,
          customer_email: customerEmail,
          amount_breakdown: JSON.stringify({
            services_total: servicesTotal,
            tip_amount: tipAmount,
            total: totalAmount,
          }),
        },
      }, { idempotencyKey });

      const isAuthorized = paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded';
      if (!isAuthorized) {
        throw new Error(`Payment authorization failed: ${paymentIntent.status}`);
      }

      // SYNCHRONOUS booking update
      await supabase.from('bookings').update({
        payment_intent_id: paymentIntent.id,
        authorized_amount: totalAmount,
        tip_amount: tipAmount,
        payment_status: 'authorized',
        status: 'confirmed',
        stripe_customer_id: stripeCustomerId,
        stripe_payment_method_id: paymentMethodId,
      }).eq('id', bookingId);

      // Background writes
      EdgeRuntime.waitUntil(
        Promise.all([
          supabase.from('transactions').insert({
            booking_id: bookingId,
            payment_intent_id: paymentIntent.id,
            amount: totalAmount,
            base_amount: servicesTotal,
            tip_amount: tipAmount,
            status: 'authorized',
            transaction_type: 'authorization',
            currency: 'usd',
            payment_method: 'card',
            guest_customer_email: customerEmail,
          }),
          supabase.from('booking_audit_log').insert({
            booking_id: bookingId,
            operation: 'payment_engine_authorize',
            status: 'success',
            payment_intent_id: paymentIntent.id,
            details: { amount: totalAmount, tip: tipAmount, services: servicesTotal },
          }),
          supabase.functions.invoke('generate-invoice', {
            body: { booking_id: bookingId, send_email: false }
          }).catch(e => console.error('[BG] Invoice gen failed:', e)),
        ]).catch(e => console.error('[BG] Error:', e))
      );

      return new Response(JSON.stringify({
        success: true,
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        amount: totalAmount,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== ACTION: RECALCULATE ==========
    if (action === 'recalculate') {
      const { bookingId, modification_reason } = payload;
      if (!bookingId) throw new Error('bookingId required');

      const userId = await validateAuth(req.headers.get('Authorization'));
      await verifyWorkerOrAdmin(userId, bookingId);

      // Lock booking
      const { data: lockData, error: lockError } = await supabase.rpc('lock_booking_for_payment', {
        p_booking_id: bookingId,
      });
      if (lockError) throw new Error(lockError.message);
      const booking = lockData?.[0];
      if (!booking) throw new Error('Booking not found');

      if (!booking.payment_intent_id) {
        return new Response(JSON.stringify({ success: true, action: 'no_op', reason: 'no_payment_intent' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const servicesTotal = await getServicesTotal(bookingId);
      const tipAmount = Number(booking.tip_amount) || 0;
      const expectedTotal = servicesTotal + tipAmount;
      const expectedCents = Math.round(expectedTotal * 100);

      // Get current PI from Stripe
      const currentPI = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

      // If amounts match, no-op
      if (Math.abs(currentPI.amount - expectedCents) <= 1) {
        return new Response(JSON.stringify({ success: true, action: 'no_op', reason: 'amounts_match' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check for saved payment method
      if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
        await supabase.from('bookings').update({
          requires_manual_payment: true,
          pending_payment_amount: expectedTotal,
          has_modifications: true,
        }).eq('id', bookingId);
        return new Response(JSON.stringify({
          success: true, action: 'requires_manual_payment',
          stripe_amount: currentPI.amount / 100, db_total: expectedTotal,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (currentPI.status === 'requires_capture') {
        // PRE-CAPTURE: Cancel old, create new
        const newVersion = booking.payment_version + 1;
        const idempotencyKey = `recalc_${bookingId}_v${newVersion}`;

        // STEP 1: Cancel old PI FIRST (cancel-before-create)
        const oldPiId = booking.payment_intent_id;
        try {
          await stripe.paymentIntents.cancel(oldPiId);
          console.log('[PAYMENT-ENGINE] Cancelled old PI:', oldPiId);
        } catch (e: any) {
          // If already cancelled/succeeded, proceed; otherwise rethrow
          if (!e.message?.includes('canceled') && !e.message?.includes('succeeded')) {
            console.error('[PAYMENT-ENGINE] Cancel failed hard:', e.message);
            throw new Error(`Failed to cancel old payment: ${e.message}`);
          }
          console.warn('[PAYMENT-ENGINE] Cancel warning (non-fatal):', e.message);
        }

        // STEP 2: Create new PI
        let newPI;
        try {
          newPI = await stripe.paymentIntents.create({
            amount: expectedCents,
            currency: 'usd',
            customer: booking.stripe_customer_id,
            payment_method: booking.stripe_payment_method_id,
            capture_method: 'manual',
            confirm: true,
            off_session: true,
            metadata: {
              booking_id: bookingId,
              original_payment_intent: oldPiId,
              reason: modification_reason || 'recalculate',
            }
          }, { idempotencyKey });
        } catch (createErr: any) {
          console.error('[PAYMENT-ENGINE] New PI creation failed:', createErr.message);
          await supabase.from('bookings').update({
            requires_manual_payment: true,
            pending_payment_amount: expectedTotal,
          }).eq('id', bookingId);
          throw new Error(`Payment reauthorization failed: ${createErr.message}. Manual payment required.`);
        }

        if (newPI.status !== 'requires_capture' && newPI.status !== 'requires_action') {
          await supabase.from('bookings').update({
            requires_manual_payment: true,
            pending_payment_amount: expectedTotal,
          }).eq('id', bookingId);
          throw new Error(`Unexpected PI status: ${newPI.status}`);
        }

        // STEP 3: Single final DB write with version increment + new PI + old PI reference
        await supabase.from('bookings').update({
          payment_intent_id: newPI.id,
          last_payment_intent_id: oldPiId,
          payment_version: newVersion,
          authorized_amount: expectedTotal,
          payment_status: 'authorized',
          pending_payment_amount: null,
          has_modifications: true,
          requires_manual_payment: false,
        }).eq('id', bookingId);

        // Update transaction
        const { error: txErr } = await supabase.from('transactions')
          .update({
            payment_intent_id: newPI.id,
            amount: expectedTotal,
            base_amount: servicesTotal,
            tip_amount: tipAmount,
          })
          .eq('booking_id', bookingId)
          .eq('status', 'authorized');
        if (txErr) {
          await supabase.from('transactions').insert({
            booking_id: bookingId,
            amount: expectedTotal,
            base_amount: servicesTotal,
            tip_amount: tipAmount,
            status: 'authorized',
            payment_intent_id: newPI.id,
            transaction_type: 'authorization',
            payment_method: 'card',
          });
        }

        // Audit + invoice in background
        EdgeRuntime.waitUntil(
          Promise.all([
            supabase.from('booking_audit_log').insert({
              booking_id: bookingId,
              operation: 'payment_engine_recalculate',
              status: 'success',
              payment_intent_id: newPI.id,
              details: {
                old_pi: booking.payment_intent_id,
                old_amount: currentPI.amount / 100,
                new_amount: expectedTotal,
                modification_reason,
              },
            }),
            supabase.functions.invoke('update-invoice', {
              body: { booking_id: bookingId, send_email: false }
            }).catch(e => console.error('[BG] Invoice update failed:', e)),
          ]).catch(e => console.error('[BG] Error:', e))
        );

        return new Response(JSON.stringify({
          success: true,
          action: 'reauthorized',
          old_payment_intent_id: booking.payment_intent_id,
          new_payment_intent_id: newPI.id,
          old_amount: currentPI.amount / 100,
          new_amount: expectedTotal,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } else if (currentPI.status === 'succeeded') {
        // POST-CAPTURE
        const capturedAmount = Number(booking.captured_amount) || (currentPI.amount / 100);
        const diffCents = expectedCents - Math.round(capturedAmount * 100);

        if (diffCents > 0) {
          // Charge difference
          return await handleChargeDifference(stripe, supabase, bookingId, booking, servicesTotal, tipAmount, expectedTotal, capturedAmount);
        } else {
          // Refund difference  
          const refundCents = Math.abs(diffCents);
          const refund = await stripe.refunds.create({
            payment_intent: booking.payment_intent_id,
            amount: refundCents,
          }, { idempotencyKey: `refund_recalc_${bookingId}_v${booking.payment_version}` });

          await supabase.from('transactions').insert({
            booking_id: bookingId,
            amount: refundCents / 100,
            status: 'completed',
            payment_intent_id: booking.payment_intent_id,
            stripe_refund_id: refund.id,
            transaction_type: 'partial_refund',
            refund_amount: refundCents / 100,
            payment_method: 'card',
          });

          return new Response(JSON.stringify({
            success: true, action: 'partial_refund',
            refund_amount: refundCents / 100, refund_id: refund.id,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({
          success: false, error: `Cannot recalculate: PI status is ${currentPI.status}`,
          requires_manual_payment: true,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ========== ACTION: CAPTURE ==========
    if (action === 'capture') {
      const { bookingId } = payload;
      if (!bookingId) throw new Error('bookingId required');

      const userId = await validateAuth(req.headers.get('Authorization'));
      await verifyWorkerOrAdmin(userId, bookingId);

      // Get booking
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('id, payment_intent_id, payment_status, tip_amount, payment_version, captured_amount, stripe_customer_id')
        .eq('id', bookingId)
        .single();
      if (bErr || !booking) throw new Error('Booking not found');
      if (booking.payment_status !== 'authorized') {
        throw new Error(`Cannot capture: payment_status is ${booking.payment_status}`);
      }
      if (!booking.payment_intent_id) throw new Error('No payment_intent_id on booking');

      const servicesTotal = await getServicesTotal(bookingId);
      const tipAmount = Number(booking.tip_amount) || 0;
      const expectedTotal = servicesTotal + tipAmount;
      const expectedCents = Math.round(expectedTotal * 100);

      // Retrieve PI
      const pi = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
      const capturableCents = pi.amount_capturable || pi.amount;

      // STRICT MISMATCH CHECK
      if (Math.abs(capturableCents - expectedCents) > 1) {
        console.error('[PAYMENT-ENGINE] capture mismatch:', { capturableCents, expectedCents });
        throw new Error(
          `Booking total changed. Expected $${expectedTotal.toFixed(2)} but Stripe has $${(capturableCents / 100).toFixed(2)} authorized. ` +
          `Please recalculate payment first.`
        );
      }

      // Capture
      const captured = await stripe.paymentIntents.capture(booking.payment_intent_id, {
        amount_to_capture: capturableCents,
      });

      if (captured.status !== 'succeeded') {
        throw new Error(`Capture failed: ${captured.status}`);
      }

      const capturedAmount = captured.amount_received / 100;

      // Update booking
      await supabase.from('bookings').update({
        payment_status: 'captured',
        captured_amount: capturedAmount,
        pending_payment_amount: null,
      }).eq('id', bookingId);

      // Update transaction
      const { error: txErr } = await supabase.from('transactions')
        .update({
          status: 'completed',
          transaction_type: 'capture',
          captured_at: new Date().toISOString(),
          amount: capturedAmount,
          base_amount: servicesTotal,
          tip_amount: tipAmount,
        })
        .eq('booking_id', bookingId)
        .eq('payment_intent_id', booking.payment_intent_id)
        .eq('status', 'authorized');

      if (txErr) {
        await supabase.from('transactions').insert({
          booking_id: bookingId,
          amount: capturedAmount,
          base_amount: servicesTotal,
          tip_amount: tipAmount,
          status: 'completed',
          payment_intent_id: booking.payment_intent_id,
          transaction_type: 'capture',
          payment_method: 'card',
          captured_at: new Date().toISOString(),
        });
      }

      // Invoice in background
      EdgeRuntime.waitUntil(
        supabase.functions.invoke('generate-invoice', {
          body: { booking_id: bookingId, send_email: true, force_regenerate: true }
        }).catch(e => console.error('[BG] Invoice gen failed:', e))
      );

      return new Response(JSON.stringify({
        success: true,
        amount_captured: capturedAmount,
        payment_intent_id: booking.payment_intent_id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== ACTION: CHARGE-DIFFERENCE ==========
    if (action === 'charge-difference') {
      const { bookingId } = payload;
      if (!bookingId) throw new Error('bookingId required');

      const userId = await validateAuth(req.headers.get('Authorization'));
      await verifyWorkerOrAdmin(userId, bookingId);

      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('id, payment_intent_id, stripe_customer_id, stripe_payment_method_id, tip_amount, captured_amount, payment_version')
        .eq('id', bookingId)
        .single();
      if (bErr || !booking) throw new Error('Booking not found');

      const servicesTotal = await getServicesTotal(bookingId);
      const tipAmount = Number(booking.tip_amount) || 0;
      const expectedTotal = servicesTotal + tipAmount;
      const capturedAmount = Number(booking.captured_amount) || 0;

      return await handleChargeDifference(stripe, supabase, bookingId, booking, servicesTotal, tipAmount, expectedTotal, capturedAmount);
    }

    // ========== ACTION: REFUND-DIFFERENCE ==========
    if (action === 'refund-difference') {
      const { bookingId, removed_services } = payload;
      if (!bookingId) throw new Error('bookingId required');
      if (!removed_services || removed_services.length === 0) throw new Error('removed_services required');

      const userId = await validateAuth(req.headers.get('Authorization'));
      await verifyWorkerOrAdmin(userId, bookingId);

      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('id, payment_intent_id, payment_version, payment_status, captured_amount')
        .eq('id', bookingId)
        .single();
      if (bErr || !booking) throw new Error('Booking not found');
      if (booking.payment_status !== 'captured') {
        throw new Error(`Refund-difference requires captured booking, got: ${booking.payment_status}`);
      }
      if (!booking.payment_intent_id) throw new Error('No payment_intent_id');

      // Look up official prices from services table
      const serviceIds = removed_services.map((s: any) => s.service_id);
      const { data: officialServices, error: svcErr } = await supabase
        .from('services')
        .select('id, base_price')
        .in('id', serviceIds);
      if (svcErr) throw new Error('Failed to fetch service prices');

      const priceMap = new Map(officialServices?.map(s => [s.id, Number(s.base_price)]) || []);

      let refundTotal = 0;
      for (const rs of removed_services) {
        const officialPrice = priceMap.get(rs.service_id);
        if (officialPrice === undefined) {
          throw new Error(`Service ${rs.service_id} not found. Cannot process refund.`);
        }
        if (officialPrice !== Number(rs.base_price)) {
          console.warn(`[PAYMENT-ENGINE] Price mismatch for ${rs.service_id}: caller=${rs.base_price}, official=${officialPrice}`);
        }
        refundTotal += officialPrice * (rs.quantity || 1);
      }

      if (refundTotal <= 0) {
        return new Response(JSON.stringify({ success: true, action: 'no_op', reason: 'zero_refund' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const refundCents = Math.round(refundTotal * 100);
      const idempotencyKey = `refund_${bookingId}_v${booking.payment_version}`;

      const refund = await stripe.refunds.create({
        payment_intent: booking.payment_intent_id,
        amount: refundCents,
        reason: 'requested_by_customer',
        metadata: {
          booking_id: bookingId,
          removed_services: removed_services.map((s: any) => s.service_name || s.service_id).join(', '),
        },
      }, { idempotencyKey });

      await supabase.from('transactions').insert({
        booking_id: bookingId,
        payment_intent_id: booking.payment_intent_id,
        amount: -refundTotal,
        transaction_type: 'partial_refund',
        status: 'completed',
        stripe_refund_id: refund.id,
        refund_amount: refundTotal,
        cancellation_reason: 'Services removed',
        payment_method: 'card',
      });

      return new Response(JSON.stringify({
        success: true,
        action: 'refund',
        refund_amount: refundTotal,
        refund_id: refund.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('[PAYMENT-ENGINE] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Payment engine error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Shared helper for charge-difference logic
async function handleChargeDifference(
  stripe: any, supabase: any, bookingId: string, booking: any,
  servicesTotal: number, tipAmount: number, expectedTotal: number, capturedAmount: number,
) {
  const diff = expectedTotal - capturedAmount;
  if (diff <= 0) {
    return new Response(JSON.stringify({ success: true, action: 'no_op', reason: 'no_additional_charge_needed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
    throw new Error('No saved payment method for additional charge');
  }

  const diffCents = Math.round(diff * 100);
  const idempotencyKey = `charge_${bookingId}_v${booking.payment_version}`;

  const additionalPI = await stripe.paymentIntents.create({
    amount: diffCents,
    currency: 'usd',
    customer: booking.stripe_customer_id,
    payment_method: booking.stripe_payment_method_id,
    confirm: true,
    off_session: true,
    metadata: {
      booking_id: bookingId,
      reason: 'additional_charge',
      original_payment_intent: booking.payment_intent_id,
    }
  }, { idempotencyKey });

  await supabase.from('transactions').insert({
    booking_id: bookingId,
    amount: diff,
    base_amount: diff,
    status: 'completed',
    payment_intent_id: additionalPI.id,
    transaction_type: 'additional_charge',
    payment_method: 'card',
  });

  await supabase.from('booking_audit_log').insert({
    booking_id: bookingId,
    operation: 'payment_engine_charge_difference',
    status: 'success',
    payment_intent_id: additionalPI.id,
    details: { additional_amount: diff, captured: capturedAmount, expected: expectedTotal },
  });

  return new Response(JSON.stringify({
    success: true,
    action: 'additional_charge',
    additional_amount: diff,
    payment_intent_id: additionalPI.id,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
