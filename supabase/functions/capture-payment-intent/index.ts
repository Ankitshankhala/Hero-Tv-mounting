import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CAPTURE-PAYMENT-INTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep('Fetching booking details', { booking_id });

    // Fetch booking details including payment info and customer info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, status, payment_intent_id, payment_status, customer_id,
        guest_customer_info, stripe_customer_id
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      logStep('Error fetching booking', { error: bookingError?.message });
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    if (!booking.payment_intent_id) {
      return new Response(
        JSON.stringify({ error: 'No payment intent found for this booking' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    logStep('Retrieving PaymentIntent from Stripe', { payment_intent_id: booking.payment_intent_id });

    // Get the current PaymentIntent status
    const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

    logStep('PaymentIntent status', { 
      status: paymentIntent.status, 
      amount: paymentIntent.amount,
      capturable: paymentIntent.amount_capturable
    });

    // Handle different PaymentIntent statuses
    if (paymentIntent.status === 'succeeded') {
      // Already captured, update our records
      await supabase
        .from('bookings')
        .update({ 
          status: 'confirmed',
          payment_status: 'completed'
        })
        .eq('id', booking_id);

      // Record the capture transaction if not already recorded
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('payment_intent_id', booking.payment_intent_id)
        .eq('transaction_type', 'capture')
        .single();

      if (!existingTransaction) {
        await supabase
          .from('transactions')
          .insert({
            booking_id,
            payment_intent_id: booking.payment_intent_id,
            amount: paymentIntent.amount / 100,
            status: 'completed',
            transaction_type: 'capture',
            currency: paymentIntent.currency.toUpperCase(),
            captured_at: new Date().toISOString()
          });
      }

      logStep('Payment already captured, updated records');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment was already captured',
          payment_intent: {
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount / 100
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentIntent.status !== 'requires_capture') {
      return new Response(
        JSON.stringify({ 
          error: `Cannot capture payment. Current status: ${paymentIntent.status}`,
          status: paymentIntent.status
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate amount to capture
    let captureAmount = paymentIntent.amount_capturable;

    // Check if there's an invoice with a total amount
    const { data: invoice } = await supabase
      .from('invoices')
      .select('total_amount')
      .eq('booking_id', booking_id)
      .single();

    if (invoice?.total_amount) {
      const invoiceAmountCents = Math.round(invoice.total_amount * 100);
      captureAmount = Math.min(invoiceAmountCents, paymentIntent.amount_capturable);
      logStep('Using invoice amount for capture', { 
        invoice_amount: invoice.total_amount,
        invoice_amount_cents: invoiceAmountCents,
        capturable_amount: paymentIntent.amount_capturable,
        final_capture_amount: captureAmount
      });
    }

    // Capture the payment
    logStep('Capturing payment', { capture_amount: captureAmount });
    
    const capturedPayment = await stripe.paymentIntents.capture(booking.payment_intent_id, {
      amount_to_capture: captureAmount,
    });

    logStep('Payment captured successfully', { 
      captured_amount: capturedPayment.amount_received,
      status: capturedPayment.status
    });

    // Update booking status
    await supabase
      .from('bookings')
      .update({ 
        status: 'confirmed',
        payment_status: 'completed'
      })
      .eq('id', booking_id);

    // Record the capture transaction
    await supabase
      .from('transactions')
      .insert({
        booking_id,
        payment_intent_id: booking.payment_intent_id,
        amount: capturedPayment.amount_received / 100,
        status: 'completed',
        transaction_type: 'capture',
        currency: capturedPayment.currency.toUpperCase(),
        captured_at: new Date().toISOString()
      });

    // Create audit log
    await supabase
      .from('booking_audit_log')
      .insert({
        booking_id,
        payment_intent_id: booking.payment_intent_id,
        operation: 'payment_capture',
        status: 'success',
        details: {
          captured_amount: capturedPayment.amount_received / 100,
          currency: capturedPayment.currency,
          stripe_payment_intent_id: capturedPayment.id
        }
      });

    logStep('Payment capture completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Payment captured successfully',
        payment_intent: {
          id: capturedPayment.id,
          status: capturedPayment.status,
          amount_captured: capturedPayment.amount_received / 100,
          currency: capturedPayment.currency
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { error: message });
    
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});