import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';
import { corsHeaders, refreshStripeMode, createStripeClient } from '../_shared/stripe.ts';
import { getServiceLineTotal } from '../_shared/pricing.ts';

/**
 * create-authorized-booking (verify_jwt=false)
 *
 * Payment-first booking orchestrator (STEP 1 of migration — not yet wired up).
 *
 * Flow (mode = 'authorize', the default):
 *   1. Validate inputs + Stripe 7-day auth window (today .. today+6).
 *   2. Verify a worker is available for the ZIP/date/time.
 *   3. Compute the authoritative total server-side via _shared/pricing.ts.
 *   4. Call payment-engine `authorize-cart` (card auth, NO booking row).
 *   5. If 3DS required — persist the cart to `pending_authorizations` and
 *      return { requires_action, client_secret, payment_intent_id }.
 *   6. If authorized — create the booking + services + coupon_usage +
 *      transaction, then fire confirmation + assignment notifications.
 *   7. On decline/error — persist NOTHING.
 *
 * Flow (mode = 'finalize'):
 *   - Called by payment-engine after the client completes a 3DS challenge.
 *   - Reads the cart from `pending_authorizations`, creates the booking as in
 *     step 6, and deletes the pending row.
 */

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

interface CartService {
  id: string;
  name?: string;
  price?: number;
  quantity?: number;
  options?: Record<string, unknown>;
}

interface GuestInfo {
  email: string;
  name?: string;
  phone?: string;
  zipcode?: string;
  zip_code?: string;
  [k: string]: unknown;
}

interface Cart {
  services: CartService[];
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  guest_customer_info: GuestInfo;
  tip_amount?: number;
  coupon_id?: string | null;
  coupon_code?: string | null;
  coupon_discount?: number;
  subtotal_before_discount?: number | null;
  payment_method_id: string;
  customer_id?: string | null;
  location_notes?: string;
  preferred_worker_id?: string | null;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Canonically price services against the DB — mirrors create-guest-booking. */
async function priceServices(supabase: any, services: CartService[]) {
  const ids = services.map((s) => s.id);
  const { data: official } = await supabase
    .from('services')
    .select('id, base_price, pricing_config')
    .in('id', ids);
  const priceMap = new Map<string, { base_price: number; pricing_config: any }>();
  for (const s of official || []) {
    priceMap.set(s.id, { base_price: Number(s.base_price), pricing_config: s.pricing_config });
  }
  const inserts: any[] = [];
  let subtotal = 0;
  for (const service of services) {
    const o = priceMap.get(service.id);
    let finalPrice = service.price ?? 0;
    const qty = service.quantity || 1;

    if (o) {
      if (o.pricing_config?.pricing_type === 'tiered' && o.pricing_config?.tiers) {
        const countMatch = service.name?.match(/\((\d+)\s+TVs?\)/i);
        const itemCount = countMatch ? parseInt(countMatch[1]) : qty;
        finalPrice = getServiceLineTotal(
          { tiers: o.pricing_config.tiers, base_price: Number(o.base_price) },
          0,
          itemCount,
        );
      } else {
        finalPrice = o.base_price;
      }
    }
    subtotal += Number(finalPrice) * (o?.pricing_config?.pricing_type === 'tiered' ? 1 : qty);
    inserts.push({
      service_id: service.id,
      service_name: service.name || 'Unknown Service',
      base_price: finalPrice,
      quantity: qty,
      configuration: service.options || {},
    });
  }
  return { subtotal, serviceInserts: inserts };
}

/** Verify worker availability for ZIP/date/time. Returns chosen worker or null. */
async function findWorker(supabase: any, cart: Cart) {
  const zip = cart.guest_customer_info.zipcode || cart.guest_customer_info.zip_code;
  const { data, error } = await supabase.rpc('find_available_workers_by_zip', {
    p_zipcode: zip,
    p_date: cart.scheduled_date,
    p_time: cart.scheduled_start,
    p_duration_minutes: 60,
  });
  if (error) throw new Error('Worker availability check failed: ' + error.message);
  if (!data || data.length === 0) return null;
  if (cart.preferred_worker_id) {
    const preferred = data.find((w: any) => w.worker_id === cart.preferred_worker_id);
    if (preferred) return preferred;
  }
  return data[0];
}

/** Create booking + services + coupon_usage + transaction; fire notifications. */
async function createBookingFromCart(
  supabase: any,
  cart: Cart,
  workerId: string,
  paymentIntentId: string,
  authorizedAmount: number,
  servicesTotal: number,
  tipAmount: number,
  serviceInserts: any[],
) {
  let stripeCustomerId: string | null = null;
  let stripePmId: string | null = cart.payment_method_id || null;
  try {
    const stripe = createStripeClient();
    const pi: any = await stripe.paymentIntents.retrieve(paymentIntentId);
    stripeCustomerId = (typeof pi.customer === 'string' ? pi.customer : pi.customer?.id) || null;
    stripePmId = (typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id) || stripePmId;
  } catch (e) { console.error('[create-authorized-booking] PI customer/PM retrieve failed:', e); }

  const { data: booking, error: bookErr } = await supabase
    .from('bookings')
    .insert({
      customer_id: cart.customer_id || null,
      service_id: cart.service_id,
      scheduled_date: cart.scheduled_date,
      scheduled_start: cart.scheduled_start,
      location_notes: cart.location_notes || '',
      status: 'confirmed',
      payment_status: 'authorized',
      requires_manual_payment: false,
      worker_id: workerId,
      preferred_worker_id: cart.preferred_worker_id || null,
      guest_customer_info: cart.guest_customer_info,
      tip_amount: tipAmount,
      coupon_id: cart.coupon_id || null,
      coupon_code: cart.coupon_code || null,
      coupon_discount: cart.coupon_discount || 0,
      subtotal_before_discount: cart.subtotal_before_discount || null,
      payment_intent_id: paymentIntentId,
      authorized_amount: authorizedAmount,
      stripe_customer_id: stripeCustomerId,
      stripe_payment_method_id: stripePmId,
    })
    .select('id')
    .single();
  if (bookErr) throw new Error('Booking insert failed: ' + bookErr.message);

  const bookingId: string = booking.id;

  const { error: svcErr } = await supabase
    .from('booking_services')
    .insert(serviceInserts.map((s) => ({ ...s, booking_id: bookingId })));
  if (svcErr) throw new Error('booking_services insert failed: ' + svcErr.message);

  // Coupon usage — idempotent
  if (cart.coupon_id) {
    const { data: existing } = await supabase
      .from('coupon_usage')
      .select('id')
      .eq('booking_id', bookingId)
      .limit(1);
    if (!existing || existing.length === 0) {
      await supabase.from('coupon_usage').insert({
        coupon_id: cart.coupon_id,
        booking_id: bookingId,
        discount_amount: Number(cart.coupon_discount) || 0,
        order_total: Number(cart.subtotal_before_discount) || authorizedAmount,
        user_id: cart.customer_id || null,
        customer_email: cart.guest_customer_info.email?.toLowerCase() || null,
      });
    }
  }

  // Transactions row
  await supabase.from('transactions').insert({
    booking_id: bookingId,
    payment_intent_id: paymentIntentId,
    amount: authorizedAmount,
    base_amount: servicesTotal,
    tip_amount: tipAmount,
    status: 'authorized',
    transaction_type: 'authorization',
    currency: 'usd',
    payment_method: 'card',
    guest_customer_email: cart.guest_customer_info.email,
  });

  await supabase.from('booking_audit_log').insert({
    booking_id: bookingId,
    operation: 'authorized_booking_created',
    status: 'success',
    payment_intent_id: paymentIntentId,
    details: { amount: authorizedAmount, tip: tipAmount, services: servicesTotal },
  });

  // Fire notifications in background — reuse existing dispatchers.
  EdgeRuntime.waitUntil((async () => {
    try {
      // Resolve worker for email payload
      const { data: worker } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .eq('id', workerId)
        .maybeSingle();
      const workerData = {
        id: worker?.id || workerId,
        name: worker?.name || 'TBD',
        email: worker?.email || '',
        phone: worker?.phone || null,
      };

      const customerEmail = cart.guest_customer_info.email;

      await Promise.all([
        workerData.email
          ? supabase.functions.invoke('unified-email-dispatcher', {
              body: { bookingId, recipientEmail: workerData.email, emailType: 'worker_assignment' },
            }).catch((e: any) => console.error('[BG] worker email failed:', e))
          : Promise.resolve(),
        customerEmail
          ? supabase.functions.invoke('unified-email-dispatcher', {
              body: {
                bookingId,
                recipientEmail: customerEmail,
                emailType: 'booking_confirmation',
                workerData,
              },
            }).catch((e: any) => console.error('[BG] customer email failed:', e))
          : Promise.resolve(),
        supabase.functions
          .invoke('send-sms-notification', { body: { bookingId } })
          .catch((e: any) => console.error('[BG] worker SMS failed:', e)),
        supabase.functions
          .invoke('send-customer-sms-notification', { body: { bookingId } })
          .catch((e: any) => console.error('[BG] customer SMS failed:', e)),
        supabase.functions
          .invoke('generate-invoice', { body: { booking_id: bookingId, send_email: false } })
          .catch((e: any) => console.error('[BG] invoice failed:', e)),
      ]);
    } catch (e) {
      console.error('[BG] notifications block failed:', e);
    }
  })());

  return bookingId;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  await refreshStripeMode();

  try {
    const supabase = getSupabaseClient();
    const body = await req.json();
    const mode: 'authorize' | 'finalize' = body.mode === 'finalize' ? 'finalize' : 'authorize';

    // ================= FINALIZE (post-3DS) =================
    if (mode === 'finalize') {
      const { payment_intent_id } = body;
      if (!payment_intent_id) throw new Error('payment_intent_id required');

      const { data: pending, error: pErr } = await supabase
        .from('pending_authorizations')
        .select('*')
        .eq('payment_intent_id', payment_intent_id)
        .maybeSingle();
      if (pErr) throw new Error('pending lookup failed: ' + pErr.message);
      if (!pending) {
        return jsonResponse({ success: false, error: 'No pending authorization for this payment_intent_id' }, 404);
      }

      const cart: Cart = pending.cart;
      const workerId: string = pending.reserved_worker_id;

      const { subtotal, serviceInserts } = await priceServices(supabase, cart.services);
      const tipAmount = Number(cart.tip_amount) || 0;
      const discount = Number(cart.coupon_discount) || 0;
      const authorizedAmount = Math.max(0, subtotal - discount) + tipAmount;

      const bookingId = await createBookingFromCart(
        supabase, cart, workerId, payment_intent_id,
        authorizedAmount, subtotal, tipAmount, serviceInserts,
      );

      await supabase.from('pending_authorizations').delete().eq('payment_intent_id', payment_intent_id);

      return jsonResponse({ success: true, booking_id: bookingId });
    }

    // ================= AUTHORIZE (default) =================
    const cart = body as Cart;

    // 1. Validation
    if (!cart.services || cart.services.length === 0) throw new Error('services[] required');
    if (!cart.service_id) throw new Error('service_id required');
    if (!cart.scheduled_date) throw new Error('scheduled_date required');
    if (!cart.scheduled_start) throw new Error('scheduled_start required');
    if (!cart.guest_customer_info?.email) throw new Error('guest_customer_info.email required');
    if (!cart.payment_method_id) throw new Error('payment_method_id required');

    // 6-day cap (today .. today+6 inclusive).
    const todayStr = new Date().toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 6);
    const maxStr = maxDate.toISOString().split('T')[0];
    if (cart.scheduled_date < todayStr || cart.scheduled_date > maxStr) {
      return jsonResponse({
        success: false,
        error: `Booking date must be between ${todayStr} and ${maxStr} (Stripe authorization window).`,
      }, 400);
    }

    // 2. Worker availability
    const worker = await findWorker(supabase, cart);
    if (!worker) {
      return jsonResponse({ success: false, error: 'no_workers_available' }, 200);
    }

    // 3. Server-side price
    const { subtotal, serviceInserts } = await priceServices(supabase, cart.services);
    const tipAmount = Number(cart.tip_amount) || 0;
    const discount = Number(cart.coupon_discount) || 0;
    const totalDollars = Math.max(0, subtotal - discount) + tipAmount;
    const amountCents = Math.round(totalDollars * 100);

    if (amountCents < 50) {
      return jsonResponse({ success: false, error: 'Cart total below Stripe minimum ($0.50).' }, 400);
    }

    // 4. Authorize the card via payment-engine (no booking row yet).
    const { data: authRes, error: authErr } = await supabase.functions.invoke('payment-engine', {
      body: {
        action: 'authorize-cart',
        amount_cents: amountCents,
        currency: 'usd',
        customer: {
          email: cart.guest_customer_info.email,
          name: cart.guest_customer_info.name,
          phone: cart.guest_customer_info.phone,
        },
        payment_method_id: cart.payment_method_id,
        metadata: {
          flow: 'payment_first',
          zipcode: String(cart.guest_customer_info.zipcode || cart.guest_customer_info.zip_code || ''),
          scheduled_date: cart.scheduled_date,
          scheduled_start: cart.scheduled_start,
        },
      },
    });
    if (authErr) throw new Error('payment-engine invoke failed: ' + authErr.message);

    // 5. 3DS branch — persist cart, no booking yet.
    if (authRes?.requires_action) {
      await supabase.from('pending_authorizations').insert({
        payment_intent_id: authRes.payment_intent_id,
        cart,
        reserved_worker_id: worker.worker_id,
      });
      return jsonResponse({
        success: false,
        requires_action: true,
        client_secret: authRes.client_secret,
        payment_intent_id: authRes.payment_intent_id,
      });
    }

    // Decline / structured card error passthrough.
    if (!authRes?.success) {
      return jsonResponse({
        success: false,
        error: authRes?.error || 'Authorization failed',
        stripe_error: authRes?.stripe_error || null,
      }, 200);
    }

    // 6. Authorized — create booking now.
    const bookingId = await createBookingFromCart(
      supabase, cart, worker.worker_id, authRes.payment_intent_id,
      totalDollars, subtotal, tipAmount, serviceInserts,
    );

    return jsonResponse({ success: true, booking_id: bookingId, payment_intent_id: authRes.payment_intent_id });

  } catch (err: any) {
    console.error('[create-authorized-booking] error:', err);
    return jsonResponse({ success: false, error: err?.message || 'unknown error' }, 400);
  }
});
