import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, amount, customerEmail, customerName, requireAuth } = await req.json();

    console.log('Creating payment intent for:', { bookingId, amount, customerEmail });

    // Initialize Supabase client with service role for database operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Log request for debugging - no booking validation needed here
    console.log('Processing payment intent creation for booking:', bookingId);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    let customerId;
    
    // Create or find Stripe customer if email provided
    if (customerEmail) {
      const customers = await stripe.customers.list({ 
        email: customerEmail, 
        limit: 1 
      });
      
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName || undefined,
        });
        customerId = customer.id;
      }
    }

    // Create payment intent with manual capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: customerId,
      capture_method: 'manual',
      metadata: {
        booking_id: bookingId,
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    // Create transaction record for payment intent creation
    try {
      // Create authorization transaction
      const { error: transactionError } = await supabaseServiceRole
        .from('transactions')
        .insert({
          booking_id: bookingId,
          amount: amount,
          status: 'pending',
          payment_intent_id: paymentIntent.id,
          payment_method: 'card',
          transaction_type: 'authorization',
          currency: 'USD',
        });

      if (transactionError) {
        console.error('Failed to create transaction record:', transactionError);
        // Don't fail the payment intent creation, but log the issue
      } else {
        console.log('Transaction record created for payment intent');
      }
    } catch (error) {
      console.error('Error creating transaction record:', error);
    }

    return new Response(JSON.stringify({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      stripe_customer_id: customerId, // Include customer ID for application use
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});