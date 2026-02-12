import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createStripeClient, corsHeaders } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

/**
 * Unified Payment Authorization Endpoint
 * Combines create-payment-intent + confirmation in single function
 * Reduces network round trips from 5 to 1 (80% reduction)
 * Target: Complete authorization in <1.5 seconds
 * 
 * CRITICAL: Saves stripe_customer_id and stripe_payment_method_id to booking
 * so that worker service modifications can trigger seamless reauthorization.
 */
serve(async (req) => {
  const startTime = performance.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = createStripeClient();
    const supabase = getSupabaseClient();

    const payload = await req.json();
    
    const {
      amount,
      bookingId,
      customerEmail,
      customerName,
      paymentMethodId, // Stripe payment method ID from frontend
    } = payload;

    console.log('[UNIFIED-AUTH] Request received:', {
      bookingId,
      amount,
      hasPaymentMethod: !!paymentMethodId
    });

    // Validate required fields
    if (!bookingId || !amount || !customerEmail || !paymentMethodId) {
      throw new Error('Missing required fields');
    }

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const dbStartTime = performance.now();
    
    // Parallelize database queries + Stripe customer lookup
    const [bookingResult, servicesResult, existingCustomerResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, customer_id, guest_customer_info')
        .eq('id', bookingId)
        .single(),
      supabase
        .from('booking_services')
        .select('base_price, quantity')
        .eq('booking_id', bookingId),
      supabase
        .from('stripe_customers')
        .select('*')
        .eq('email', customerEmail)
        .maybeSingle()
    ]);

    const dbTime = performance.now() - dbStartTime;
    console.log(`[PERF] Database queries: ${dbTime.toFixed(0)}ms`);

    if (bookingResult.error || !bookingResult.data) {
      throw new Error('Booking not found');
    }

    if (servicesResult.error) {
      throw new Error('Failed to fetch booking services');
    }

    if (!servicesResult.data || servicesResult.data.length === 0) {
      throw new Error('Booking has no services');
    }

    const servicesTotal = servicesResult.data.reduce((sum, service) => {
      return sum + (Number(service.base_price) * service.quantity);
    }, 0);

    const amountInCents = Math.round(amount * 100);

    // --- Stripe Customer: find or create, then attach payment method ---
    const stripeStartTime = performance.now();
    let stripeCustomerId: string;

    if (existingCustomerResult.data?.stripe_customer_id) {
      stripeCustomerId = existingCustomerResult.data.stripe_customer_id;
      console.log('[UNIFIED-AUTH] Using existing Stripe customer:', stripeCustomerId);
      
      // Attach payment method to existing customer (idempotent if already attached)
      try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
      } catch (attachErr: any) {
        // Ignore "already attached" errors
        if (!attachErr.message?.includes('already been attached')) {
          console.warn('[UNIFIED-AUTH] Payment method attach warning:', attachErr.message);
        }
      }
    } else {
      // Create new Stripe customer
      console.log('[UNIFIED-AUTH] Creating new Stripe customer for:', customerEmail);
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName || 'Guest Customer',
        metadata: { booking_id: bookingId },
      });
      stripeCustomerId = customer.id;

      // Attach payment method
      await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });

      // Store in stripe_customers table
      await supabase.from('stripe_customers').insert({
        email: customerEmail,
        name: customerName || 'Guest Customer',
        stripe_customer_id: stripeCustomerId,
        stripe_default_payment_method_id: paymentMethodId,
      });
    }

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    console.log('[UNIFIED-AUTH] Creating and confirming PaymentIntent...');

    // Create PaymentIntent with automatic confirmation + customer
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: stripeCustomerId,
      capture_method: 'manual',
      payment_method: paymentMethodId,
      confirm: true, // Auto-confirm in single API call
      return_url: `${Deno.env.get('FRONTEND_URL') || 'https://46f26668-c441-4bdc-97f1-d65e49c18661.lovableproject.com'}/booking/payment-complete`,
      metadata: {
        booking_id: bookingId,
        customer_email: customerEmail,
        customer_name: customerName || 'Guest Customer',
        amount_breakdown: JSON.stringify({
          services_total: servicesTotal,
          tip_amount: amount - servicesTotal,
          total: amount,
        }),
      },
    });

    const stripeTime = performance.now() - stripeStartTime;
    console.log(`[PERF] Stripe customer+create+confirm: ${stripeTime.toFixed(0)}ms`);

    // Check if authorization succeeded
    const isAuthorized = paymentIntent.status === 'requires_capture' || 
                        paymentIntent.status === 'succeeded';

    if (!isAuthorized) {
      throw new Error(`Payment authorization failed: ${paymentIntent.status}`);
    }

    // CRITICAL: Synchronous booking update — must complete before response
    // This saves payment_intent_id, stripe_customer_id, and stripe_payment_method_id
    // so that worker service modifications can trigger seamless reauthorization.
    const { error: bookingUpdateError } = await supabase.from('bookings').update({
      payment_intent_id: paymentIntent.id,
      payment_status: 'authorized',
      status: 'confirmed',
      stripe_customer_id: stripeCustomerId,
      stripe_payment_method_id: paymentMethodId,
    }).eq('id', bookingId);

    if (bookingUpdateError) {
      console.error('[UNIFIED-AUTH] CRITICAL: Booking update failed:', bookingUpdateError);
      // Don't throw — payment succeeded, we need to return the PI ID
    }

    // Background non-critical writes (transaction, audit log, invoice)
    EdgeRuntime.waitUntil(
      Promise.all([
        supabase.from('transactions').insert({
          booking_id: bookingId,
          payment_intent_id: paymentIntent.id,
          amount: amount,
          base_amount: servicesTotal,
          tip_amount: amount - servicesTotal,
          status: 'authorized',
          transaction_type: 'authorization',
          currency: 'usd',
          payment_method: 'card',
          guest_customer_email: customerEmail,
        }),
        supabase.from('booking_audit_log').insert({
          booking_id: bookingId,
          operation: 'unified_payment_authorized',
          status: 'success',
          payment_intent_id: paymentIntent.id,
          details: {
            amount: amount,
            stripe_status: paymentIntent.status,
            stripe_customer_id: stripeCustomerId,
          }
        }),
        supabase.functions.invoke('generate-invoice', {
          body: {
            booking_id: bookingId,
            send_email: false
          }
        }).then(result => {
          console.log('[BACKGROUND] Draft invoice generated:', result.data?.invoice?.invoice_number || 'unknown');
        }).catch(err => {
          console.error('[BACKGROUND] Invoice generation failed:', err);
        })
      ]).catch(error => {
        console.error('[BACKGROUND] Database update error:', error);
      })
    );

    const totalTime = performance.now() - startTime;
    console.log(`[PERF] Total unified auth time: ${totalTime.toFixed(0)}ms (target: <1500ms)`);

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        amount: amount,
        performance: {
          total_ms: Math.round(totalTime),
          db_ms: Math.round(dbTime),
          stripe_ms: Math.round(stripeTime)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const totalTime = performance.now() - startTime;
    console.error('[UNIFIED-AUTH] Error:', error, `(${totalTime.toFixed(0)}ms)`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Payment authorization failed'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
