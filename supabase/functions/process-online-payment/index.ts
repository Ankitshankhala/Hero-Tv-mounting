import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-ONLINE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting online payment processing');
    
    const { bookingId, amount, customerEmail, customerName, paymentMethodId } = await req.json();
    
    if (!bookingId || !amount || !customerEmail) {
      throw new Error('Booking ID, amount, and customer email are required');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep('Creating payment intent', { bookingId, amount });

    // Create or retrieve customer
    let customerId;
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep('Found existing customer', { customerId });
    } else {
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
      });
      customerId = customer.id;
      logStep('Created new customer', { customerId });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${req.headers.get('origin')}/booking-success`,
      metadata: {
        booking_id: bookingId,
      },
    });

    logStep('Payment intent created', { 
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status 
    });

    // Record transaction
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        booking_id: bookingId,
        payment_intent_id: paymentIntent.id,
        amount: amount,
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'authorized',
        transaction_type: 'charge',
        payment_method: 'card',
        currency: 'USD'
      });

    if (transactionError) {
      logStep('Failed to record transaction', { error: transactionError });
    } else {
      logStep('Transaction recorded successfully');
    }

    return new Response(JSON.stringify({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      transactionId: paymentIntent.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error processing online payment', { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});