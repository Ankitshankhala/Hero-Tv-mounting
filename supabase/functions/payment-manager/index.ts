import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PAYMENT-MANAGER] ${step}${detailsStr}`);
};

const ensureSafeStatus = (status: string, context: string = 'unknown'): string => {
  const normalizedStatus = String(status).toLowerCase().trim();
  
  let safeStatus: string;
  switch (normalizedStatus) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
    case 'pending':
      safeStatus = 'pending';
      break;
    case 'requires_capture':
    case 'authorized':
    case 'payment_authorized':
      safeStatus = 'authorized';
      break;
    case 'succeeded':
    case 'completed':
      safeStatus = 'completed';
      break;
    case 'captured':
      safeStatus = 'captured';
      break;
    case 'canceled':
    case 'cancelled':
    case 'failed':
    case 'payment_failed':
    default:
      safeStatus = 'failed';
      break;
  }
  
  const validStatuses = ['pending', 'completed', 'failed', 'authorized', 'captured', 'cancelled'];
  if (!validStatuses.includes(safeStatus)) {
    safeStatus = 'failed';
  }
  
  return safeStatus;
};

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret || !stripeSecret.startsWith('sk_')) {
      throw new Error('Invalid Stripe secret key configuration');
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    switch (action) {
      case 'create-intent':
        return await createPaymentIntent(req, stripe, supabase);
      case 'capture-payment':
        return await capturePayment(req, stripe, supabase);
      case 'get-payment-info':
        return await getPaymentMethodInfo(req, stripe);
      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    logStep('ERROR', { error: error.message });
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});

async function createPaymentIntent(req: Request, stripe: Stripe, supabase: any) {
  const body = await req.json();
  const {
    amount,
    currency,
    idempotency_key,
    user_id,
    guest_customer_info,
    booking_id,
    testing_mode
  } = body;

  logStep("Creating payment intent", { amount, currency, booking_id });

  // Validation
  if (!amount || !currency || !booking_id || !idempotency_key) {
    throw new Error('Missing required fields');
  }

  if (!isValidUUID(idempotency_key)) {
    throw new Error('Invalid idempotency_key format');
  }

  // Check for existing transaction
  const { data: existingTransaction, error: existingError } = await supabase
    .from('transactions')
    .select('id, payment_intent_id, status, amount')
    .eq('idempotency_key', idempotency_key)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Database error: ${existingError.message}`);
  }

  if (existingTransaction) {
    return new Response(JSON.stringify({
      client_secret: null,
      payment_intent_id: existingTransaction.payment_intent_id,
      transaction_id: existingTransaction.id,
      status: existingTransaction.status,
      is_existing: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Check for saved payment method
  let userWithSavedCard = null;
  if (user_id) {
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_default_payment_method_id, has_saved_card')
      .eq('id', user_id)
      .single();

    if (userData?.has_saved_card && userData?.stripe_default_payment_method_id) {
      userWithSavedCard = userData;
    }
  }

  // Create payment intent
  const amountInCents = Math.round(amount * 100);
  if (amountInCents > 1000000) {
    throw new Error(`Amount too high: $${amount}. Maximum allowed is $10,000.`);
  }

  const metadata: any = {
    idempotency_key,
    booking_id
  };

  if (user_id) {
    metadata.user_id = user_id;
  } else if (guest_customer_info) {
    metadata.guest_email = guest_customer_info.email;
    metadata.guest_name = guest_customer_info.name;
    metadata.is_guest = 'true';
  }

  if (testing_mode) {
    metadata.test_mode = 'true';
  }

  const paymentIntentParams: any = {
    amount: amountInCents,
    currency: currency.toLowerCase(),
    metadata,
    capture_method: 'manual'
  };

  if (userWithSavedCard) {
    paymentIntentParams.customer = userWithSavedCard.stripe_customer_id;
    paymentIntentParams.payment_method = userWithSavedCard.stripe_default_payment_method_id;
    paymentIntentParams.confirmation_method = 'automatic';
    paymentIntentParams.confirm = true;
    paymentIntentParams.off_session = true;
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, {
    idempotencyKey: idempotency_key,
  });

  // Create transaction record
  const safeStatus = ensureSafeStatus(paymentIntent.status);
  const transactionInsert: any = {
    amount,
    status: safeStatus,
    payment_intent_id: paymentIntent.id,
    payment_method: 'card',
    transaction_type: 'authorization',
    currency: currency.toUpperCase(),
    idempotency_key,
    booking_id
  };

  if (guest_customer_info && !user_id) {
    transactionInsert.guest_customer_email = guest_customer_info.email;
  }

  const { data: transactionData } = await supabase
    .from('transactions')
    .insert(transactionInsert)
    .select('id, status')
    .single();

  // Update booking
  if (booking_id) {
    await supabase
      .from('bookings')
      .update({
        payment_intent_id: paymentIntent.id,
        status: 'payment_pending',
        payment_status: 'pending'
      })
      .eq('id', booking_id);
  }

  return new Response(JSON.stringify({
    client_secret: paymentIntent.client_secret,
    payment_intent_id: paymentIntent.id,
    transaction_id: transactionData?.id,
    status: safeStatus,
    is_existing: false
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function capturePayment(req: Request, stripe: Stripe, supabase: any) {
  const { bookingId, capturedBy } = await req.json();

  if (!bookingId) {
    throw new Error("Booking ID is required");
  }

  logStep(`Starting payment capture for booking ${bookingId}`);

  // Get booking details
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    throw new Error("Booking not found");
  }

  if (!booking.payment_intent_id) {
    throw new Error("No payment intent found for this booking");
  }

  // Capture the payment intent
  const paymentIntent = await stripe.paymentIntents.capture(booking.payment_intent_id);
  
  // Update booking to completed status
  await supabase
    .from('bookings')
    .update({
      payment_status: 'completed',
      status: 'completed'
    })
    .eq('id', bookingId);

  // Record the capture transaction
  await supabase
    .from('transactions')
    .insert({
      booking_id: bookingId,
      amount: paymentIntent.amount / 100,
      status: 'completed',
      payment_intent_id: booking.payment_intent_id,
      transaction_type: 'capture',
      payment_method: 'card',
      captured_by: capturedBy,
      captured_at: new Date().toISOString(),
      currency: paymentIntent.currency.toUpperCase()
    });

  // Log the capture
  await supabase
    .from('sms_logs')
    .insert({
      booking_id: bookingId,
      recipient_number: 'system',
      message: `Payment captured and booking completed - will be auto-archived`,
      status: 'sent'
    });

  return new Response(JSON.stringify({
    success: true,
    payment_intent: {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
    },
    booking_status: 'completed',
    will_archive: true
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function getPaymentMethodInfo(req: Request, stripe: Stripe) {
  const { paymentMethodId } = await req.json();

  if (!paymentMethodId) {
    throw new Error('Payment method ID is required');
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

  return new Response(JSON.stringify({
    success: true,
    last4: paymentMethod.card?.last4,
    brand: paymentMethod.card?.brand,
    exp_month: paymentMethod.card?.exp_month,
    exp_year: paymentMethod.card?.exp_year,
    type: paymentMethod.type
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}