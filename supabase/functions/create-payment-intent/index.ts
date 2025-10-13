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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const payload = await req.json();
    
    // Normalize customer email and name for backward compatibility
    const customer_email = payload.customer_email || payload.guest_customer_info?.email;
    const customer_name = payload.customer_name || payload.guest_customer_info?.name || 'Guest Customer';
    const booking_id = payload.booking_id;
    const amount = payload.amount;

    console.log('[CREATE-PAYMENT-INTENT] Keys present:', {
      has_booking_id: !!booking_id,
      has_amount: typeof amount === 'number',
      has_customer_email: !!customer_email,
      has_guest_info: !!payload.guest_customer_info
    });

    // Validate required fields
    if (!booking_id || !amount || !customer_email) {
      throw new Error('Missing required fields: booking_id, amount, customer_email');
    }

    // Validate amount is positive
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Get booking details to validate amount
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, customer_id, guest_customer_info')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Get booking services total
    const { data: bookingServices, error: servicesError } = await supabase
      .from('booking_services')
      .select('base_price, quantity')
      .eq('booking_id', booking_id);

    if (servicesError) {
      throw new Error('Failed to fetch booking services');
    }

    // Calculate expected total (NO TAX, NO MARKUPS)
    const servicesTotal = (bookingServices || []).reduce((sum, service) => {
      return sum + (Number(service.base_price) * service.quantity);
    }, 0);

    console.log('[CREATE-PAYMENT-INTENT] Services total:', servicesTotal);
    console.log('[CREATE-PAYMENT-INTENT] Requested amount:', amount);

    // CRITICAL: Amount should be Services Total + Tip only (NO TAX, NO FEES)
    // Allow small floating point differences (< $0.01)
    const difference = Math.abs(amount - servicesTotal);
    if (difference > servicesTotal && difference > 0.01) {
      console.warn('[CREATE-PAYMENT-INTENT] Amount mismatch - Services:', servicesTotal, 'Requested:', amount);
      // We'll allow it but log the warning - the tip might be included
    }

    // Convert to cents - EXACT amount, no modifications
    const amountInCents = Math.round(amount * 100);

    console.log('[CREATE-PAYMENT-INTENT] Creating payment intent for:', amountInCents, 'cents ($' + amount + ')');

    // Create Stripe PaymentIntent with manual capture (authorization only)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual', // Authorization only - capture later when service complete
      metadata: {
        booking_id,
        customer_email,
        customer_name: customer_name || 'Guest Customer',
        amount_breakdown: JSON.stringify({
          services_total: servicesTotal,
          tip_amount: amount - servicesTotal,
          total: amount,
          tax: 0, // NO TAX as per requirements
          fees: 0, // NO FEES as per requirements
        }),
      },
    });

    console.log('[CREATE-PAYMENT-INTENT] Payment intent created:', paymentIntent.id);

    // Record transaction in database with status 'pending'
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        booking_id,
        payment_intent_id: paymentIntent.id,
        amount: amount,
        base_amount: servicesTotal,
        tip_amount: amount - servicesTotal,
        status: 'pending',
        transaction_type: 'authorization',
        currency: 'usd',
        payment_method: 'card',
        guest_customer_email: customer_email,
      });

    if (transactionError) {
      console.error('[CREATE-PAYMENT-INTENT] Transaction record failed:', transactionError);
      // Don't fail the request - Stripe PI was created successfully
    }

    // Update booking with payment_intent_id
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_intent_id: paymentIntent.id,
        payment_status: 'pending',
      })
      .eq('id', booking_id);

    if (updateError) {
      console.error('[CREATE-PAYMENT-INTENT] Booking update failed:', updateError);
    }

    console.log('[CREATE-PAYMENT-INTENT] Success - Amount: $' + amount + ' (NO tax, NO fees, EXACT amount)');

    return new Response(
      JSON.stringify({
        success: true,
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        amount: amount,
        amount_cents: amountInCents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CREATE-PAYMENT-INTENT] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to create payment intent'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
