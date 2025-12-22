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

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const { booking_id, payment_intent_id } = await req.json();

    console.log('[CAPTURE-PAYMENT] Starting capture for:', { booking_id, payment_intent_id });

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, transactions(*)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('[CAPTURE-PAYMENT] Booking not found:', bookingError);
      throw new Error('Booking not found');
    }

    console.log('[CAPTURE-PAYMENT] Booking details:', {
      id: booking.id,
      status: booking.status,
      payment_status: booking.payment_status,
      payment_intent_id: booking.payment_intent_id,
      pending_payment_amount: booking.pending_payment_amount
    });

    // Validate payment is ready for capture
    if (booking.payment_status !== 'authorized') {
      throw new Error(`Cannot capture payment with status: ${booking.payment_status}. Payment must be authorized first.`);
    }

    // Log booking status for debugging, but don't block capture
    console.log('[CAPTURE-PAYMENT] Booking status:', booking.status, '(capture allowed regardless of booking status)');

    const intentId = payment_intent_id || booking.payment_intent_id;
    if (!intentId) {
      throw new Error('No payment intent ID found');
    }

    // Get services total for record keeping (NOT for determining capture amount)
    const { data: currentServices, error: servicesError } = await supabase
      .from('booking_services')
      .select('base_price, quantity')
      .eq('booking_id', booking.id);

    if (servicesError) {
      console.error('[CAPTURE-PAYMENT] Error fetching services:', servicesError);
      throw new Error('Failed to calculate total amount from services');
    }

    const servicesTotal = currentServices?.reduce((sum, s) => sum + (s.base_price * s.quantity), 0) || 0;
    const tipAmount = booking.tip_amount || 0;

    console.log('[CAPTURE-PAYMENT] Amount breakdown:', {
      services_total: servicesTotal,
      tip_amount: tipAmount,
      booking_tip: booking.tip_amount
    });

    // First, retrieve the PaymentIntent to check its current state
    const currentIntent = await stripe.paymentIntents.retrieve(intentId);
    console.log('[CAPTURE-PAYMENT] Current PaymentIntent:', {
      id: currentIntent.id,
      status: currentIntent.status,
      amount: currentIntent.amount,
      amount_capturable: currentIntent.amount_capturable
    });

    // CRITICAL FIX: Use the FULL authorized amount from Stripe, NOT recalculated amount
    // This prevents tip reversal - we capture exactly what was authorized
    const captureAmountCents = currentIntent.amount_capturable || currentIntent.amount;
    
    // Get the original authorized transaction to verify tip preservation
    const { data: authorizedTx } = await supabase
      .from('transactions')
      .select('amount, base_amount, tip_amount')
      .eq('booking_id', booking.id)
      .eq('payment_intent_id', intentId)
      .eq('status', 'authorized')
      .single();

    // Log any discrepancy for audit purposes (but still capture full amount)
    const expectedAmountCents = Math.round((servicesTotal + tipAmount) * 100);
    if (captureAmountCents !== expectedAmountCents) {
      console.warn('[CAPTURE-PAYMENT] ⚠️ Amount discrepancy detected (capturing full authorized amount):', {
        stripe_authorized: captureAmountCents,
        calculated_from_services: expectedAmountCents,
        difference_cents: captureAmountCents - expectedAmountCents,
        tip_amount: tipAmount,
        note: 'Capturing full authorized amount to preserve tip'
      });
    }

    // Capture the payment through Stripe - use FULL authorized amount
    console.log('[CAPTURE-PAYMENT] Capturing Stripe PaymentIntent:', intentId, 'amount:', captureAmountCents);
    const paymentIntent = await stripe.paymentIntents.capture(intentId, {
      amount_to_capture: captureAmountCents
    });

    if (paymentIntent.status !== 'succeeded') {
      console.error('[CAPTURE-PAYMENT] Capture failed:', paymentIntent.status);
      throw new Error(`Payment capture failed with status: ${paymentIntent.status}`);
    }

    const capturedAmount = paymentIntent.amount_received / 100;
    console.log('[CAPTURE-PAYMENT] Successfully captured:', capturedAmount);

    // CRITICAL FIX: Preserve base_amount and tip_amount in transaction update
    // Use values from authorized transaction if available, otherwise from booking
    const finalBaseAmount = authorizedTx?.base_amount || servicesTotal;
    const finalTipAmount = authorizedTx?.tip_amount || tipAmount;

    console.log('[CAPTURE-PAYMENT] Preserving tip breakdown:', {
      base_amount: finalBaseAmount,
      tip_amount: finalTipAmount,
      total: capturedAmount
    });

    // Update existing transaction record from 'authorized' to 'completed'
    let finalTransaction;
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        transaction_type: 'capture',
        captured_at: new Date().toISOString(),
        amount: capturedAmount,
        base_amount: finalBaseAmount,
        tip_amount: finalTipAmount
      })
      .eq('booking_id', booking.id)
      .eq('payment_intent_id', intentId)
      .eq('status', 'authorized')
      .select()
      .single();

    if (transactionError) {
      console.error('[CAPTURE-PAYMENT] Transaction update error:', transactionError);
      
      // Fallback: If no authorized transaction exists, create a new one with full tip breakdown
      const { data: newTransaction, error: insertError } = await supabase
        .from('transactions')
        .insert({
          booking_id: booking.id,
          amount: capturedAmount,
          base_amount: servicesTotal,
          tip_amount: tipAmount,
          status: 'completed',
          payment_intent_id: intentId,
          transaction_type: 'capture',
          payment_method: 'card',
          captured_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (insertError) {
        console.error('[CAPTURE-PAYMENT] Fallback insert also failed:', insertError);
        throw new Error('Failed to update or create transaction record');
      }
      
      console.log('[CAPTURE-PAYMENT] Created new transaction record (fallback) with tip preserved:', {
        base_amount: servicesTotal,
        tip_amount: tipAmount
      });
      finalTransaction = newTransaction;
    } else {
      console.log('[CAPTURE-PAYMENT] Updated transaction with tip preserved:', {
        base_amount: finalBaseAmount,
        tip_amount: finalTipAmount
      });
      finalTransaction = transaction;
    }

    // Update booking payment_status to 'captured'
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        payment_status: 'captured',
        pending_payment_amount: null
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('[CAPTURE-PAYMENT] Booking update error:', updateError);
      throw new Error('Failed to update booking payment status');
    }

    console.log('[CAPTURE-PAYMENT] Payment captured successfully');

    // Generate/update invoice after successful capture
    try {
      console.log('[CAPTURE-PAYMENT] Generating invoice after capture...');
      const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke('generate-invoice', {
        body: {
          booking_id: booking.id,
          send_email: true,
          force_regenerate: true
        }
      });

      if (invoiceError) {
        console.error('[CAPTURE-PAYMENT] Invoice generation failed:', invoiceError);
      } else {
        console.log('[CAPTURE-PAYMENT] Invoice generated:', invoiceData?.invoice?.invoice_number);
      }
    } catch (invoiceErr) {
      console.error('[CAPTURE-PAYMENT] Invoice generation error:', invoiceErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: finalTransaction.id,
        amount_captured: capturedAmount,
        payment_intent_id: intentId,
        message: 'Payment captured successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CAPTURE-PAYMENT] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Payment capture failed'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
