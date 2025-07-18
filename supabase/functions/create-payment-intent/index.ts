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

    // Handle test booking scenario
    if (bookingId === 'temp-booking-ref') {
      return new Response(JSON.stringify({
        success: true,
        client_secret: 'pi_test_client_secret',
        payment_intent_id: 'pi_test_intent'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Initialize Supabase client with service role for database operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Validate booking exists (skip for temp bookings)
    if (!bookingId.startsWith('temp-')) {
      const { data: booking, error: bookingError } = await supabaseServiceRole
        .from('bookings')
        .select('id, customer_id, status')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error('Booking not found');
      }
    }

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

    // Update booking with payment intent ID if not temp booking
    if (!bookingId.startsWith('temp-')) {
      const { error: updateError } = await supabaseServiceRole
        .from('bookings')
        .update({
          payment_intent_id: paymentIntent.id,
          payment_status: 'authorized',
          stripe_customer_id: customerId,
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking:', updateError);
        throw updateError;
      }

      // Create transaction record for authorization
      const { error: transactionError } = await supabaseServiceRole
        .from('transactions')
        .insert({
          booking_id: bookingId,
          amount: amount,
          status: 'pending',
          payment_intent_id: paymentIntent.id,
          payment_method: 'card',
          transaction_type: 'authorization',
        });

      if (transactionError) {
        console.error('Failed to create transaction:', transactionError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
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