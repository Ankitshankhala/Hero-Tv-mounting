import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createStripeClient, corsHeaders } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

/**
 * Unified Payment Authorization Endpoint
 * Combines create-payment-intent + confirmation in single function
 * Reduces network round trips from 5 to 1 (80% reduction)
 * Target: Complete authorization in <1.5 seconds
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
    
    // Parallelize database queries
    const [bookingResult, servicesResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, customer_id, guest_customer_info')
        .eq('id', bookingId)
        .single(),
      supabase
        .from('booking_services')
        .select('base_price, quantity')
        .eq('booking_id', bookingId)
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

    console.log('[UNIFIED-AUTH] Creating and confirming PaymentIntent...');
    const stripeStartTime = performance.now();

    // Create PaymentIntent with automatic confirmation
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual',
      payment_method: paymentMethodId,
      off_session: true, // Backend authorization without user present
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
    console.log(`[PERF] Stripe create+confirm: ${stripeTime.toFixed(0)}ms`);

    // Check if authorization succeeded
    const isAuthorized = paymentIntent.status === 'requires_capture' || 
                        paymentIntent.status === 'succeeded';

    if (!isAuthorized) {
      throw new Error(`Payment authorization failed: ${paymentIntent.status}`);
    }

    // Background database updates (non-blocking)
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
        supabase.from('bookings').update({
          payment_intent_id: paymentIntent.id,
          payment_status: 'authorized',
        }).eq('id', bookingId),
        supabase.from('booking_audit_log').insert({
          booking_id: bookingId,
          operation: 'unified_payment_authorized',
          status: 'success',
          payment_intent_id: paymentIntent.id,
          details: {
            amount: amount,
            stripe_status: paymentIntent.status,
          }
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
