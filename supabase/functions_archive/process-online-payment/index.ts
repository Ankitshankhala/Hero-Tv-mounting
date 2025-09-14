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
    
    if (!bookingId || !amount || !customerEmail || !customerName) {
      throw new Error('Booking ID, amount, customer email, and customer name are required');
    }

    if (!paymentMethodId) {
      throw new Error('Payment method ID is required');
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

    // CRITICAL FIX: Convert amount to cents properly
    const amountInCents = Math.round(amount * 100);
    
    // Add amount validation to prevent unreasonably high charges
    if (amountInCents > 1000000) { // $10,000 limit
      throw new Error(`Amount too high: $${amount}. Maximum allowed is $10,000.`);
    }
    
    logStep('Converting amount', { originalAmount: amount, amountInCents });

    // Verify and attach payment method to customer
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      logStep('Retrieved payment method', { 
        paymentMethodId, 
        customer: paymentMethod.customer,
        type: paymentMethod.type 
      });

      // Attach payment method to customer if not already attached
      if (paymentMethod.customer !== customerId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });
        logStep('Attached payment method to customer', { paymentMethodId, customerId });
      }
    } catch (attachError) {
      logStep('Failed to attach payment method', { error: attachError.message });
      throw new Error(`Payment method setup failed: ${attachError.message}`);
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents, // Properly converted to cents
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${req.headers.get('origin')}/booking-success`,
      metadata: {
        booking_id: bookingId,
        original_amount_dollars: amount.toString() // Track original amount for debugging
      },
    });

    logStep('Payment intent created', { 
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status 
    });

    // Record transaction and ensure status synchronization
    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        booking_id: bookingId,
        payment_intent_id: paymentIntent.id,
        amount: amount,
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'authorized',
        transaction_type: 'charge',
        payment_method: 'card',
        currency: 'USD'
      })
      .select('id')
      .single();

    if (transactionError) {
      logStep('Failed to record transaction', { error: transactionError });
      throw new Error(`Transaction recording failed: ${transactionError.message}`);
    }

    logStep('Transaction recorded successfully', { transactionId: transactionData.id });

    // CRITICAL FIX: Call update-transaction-status to ensure booking status sync
    try {
      const { data: statusUpdateData, error: statusUpdateError } = await supabase.functions.invoke(
        'update-transaction-status',
        {
          body: {
            payment_intent_id: paymentIntent.id,
            status: paymentIntent.status
          }
        }
      );

      if (statusUpdateError) {
        logStep('Status update failed but continuing', { error: statusUpdateError });
      } else {
        logStep('Status synchronized successfully', statusUpdateData);
      }
    } catch (statusError) {
      logStep('Status sync error but continuing', { error: statusError });
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
    
    // Enhanced error handling for Stripe errors
    let errorMessage = error.message;
    let errorCode = 'payment_processing_failed';
    
    if (error.type === 'StripeCardError') {
      errorCode = error.code || 'card_error';
      errorMessage = error.message;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorCode = 'invalid_request';
      errorMessage = error.message;
    } else if (error.type === 'StripeAuthenticationError') {
      errorCode = 'authentication_error';
      errorMessage = 'Payment authentication failed';
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      errorCode,
      details: error.type || 'unknown_error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});