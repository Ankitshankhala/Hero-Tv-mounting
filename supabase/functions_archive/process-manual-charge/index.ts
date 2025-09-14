
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-MANUAL-CHARGE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    logStep('Function started');
    const { bookingId, customerId, paymentMethodId, amount, chargeType, description } = await req.json()

    logStep('Request received', { bookingId, amount, chargeType, paymentMethodId: paymentMethodId?.substring(0, 8) + '...' });

    // Validate required fields
    if (!bookingId) throw new Error('bookingId is required');
    if (!paymentMethodId) throw new Error('paymentMethodId is required');
    if (!amount || amount <= 0) throw new Error('Valid amount is required');

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      logStep('ERROR: STRIPE_SECRET_KEY not configured');
      throw new Error('Stripe configuration error - secret key not found');
    }

    if (!stripeSecretKey.startsWith('sk_')) {
      logStep('ERROR: Invalid Stripe secret key format', { keyPrefix: stripeSecretKey.substring(0, 8) });
      throw new Error('Invalid Stripe secret key format');
    }

    logStep('Stripe key validated', { keyType: stripeSecretKey.substring(0, 8) });

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    logStep('Processing manual charge', { bookingId, customerId, amount, chargeType });

    // Get booking info to find customer
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('customer_id, guest_customer_info, stripe_customer_id')
      .eq('id', bookingId)
      .single()

    if (bookingError) {
      logStep('Booking fetch failed', { error: bookingError });
      throw new Error(`Failed to fetch booking: ${bookingError.message}`)
    }

    logStep('Booking retrieved', { 
      hasCustomerId: !!booking.customer_id, 
      hasGuestInfo: !!booking.guest_customer_info,
      hasStripeCustomer: !!booking.stripe_customer_id 
    });

    let stripeCustomerId = booking.stripe_customer_id

    // If we don't have a Stripe customer, create one
    if (!stripeCustomerId) {
      let customerEmail, customerName
      
      if (booking.customer_id) {
        // Get customer from users table
        const { data: user } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', booking.customer_id)
          .single()
        
        customerEmail = user?.email
        customerName = user?.name
        logStep('Customer from users table', { email: customerEmail, name: customerName });
      } else if (booking.guest_customer_info) {
        // Get customer from guest info
        customerEmail = booking.guest_customer_info.email
        customerName = booking.guest_customer_info.name
        logStep('Customer from guest info', { email: customerEmail, name: customerName });
      }

      if (customerEmail) {
        try {
          // Create Stripe customer
          const customer = await stripe.customers.create({
            email: customerEmail,
            name: customerName,
            metadata: {
              booking_id: bookingId,
              source: 'manual_charge'
            }
          })
          
          stripeCustomerId = customer.id
          logStep('Stripe customer created', { customerId: stripeCustomerId });

          // Update booking with Stripe customer ID
          await supabase
            .from('bookings')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', bookingId)
            
          logStep('Booking updated with Stripe customer ID');
        } catch (customerError) {
          logStep('Failed to create Stripe customer', { error: customerError });
          throw new Error(`Failed to create Stripe customer: ${customerError.message}`);
        }
      }
    }

    // Verify payment method exists and retrieve it
    let paymentMethod;
    try {
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      logStep('Payment method retrieved', { 
        id: paymentMethod.id, 
        type: paymentMethod.type,
        card: paymentMethod.card ? `****${paymentMethod.card.last4}` : 'N/A'
      });
    } catch (pmError) {
      logStep('Failed to retrieve payment method', { error: pmError });
      throw new Error(`Invalid payment method: ${pmError.message}`);
    }

    // Attach payment method to customer if not already attached
    if (stripeCustomerId && paymentMethod.customer !== stripeCustomerId) {
      try {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId,
        });
        logStep('Payment method attached to customer');
      } catch (attachError) {
        logStep('Failed to attach payment method', { error: attachError });
        throw new Error(`Failed to attach payment method: ${attachError.message}`);
      }
    }

    // Create payment intent with immediate confirmation
    let paymentIntent;
    try {
      // CRITICAL FIX: Convert amount to cents here (frontend sends dollars)
      const amountInCents = Math.round(amount * 100);
      
      // Add amount validation to prevent unreasonably high charges
      if (amountInCents > 1000000) { // $10,000 limit
        throw new Error(`Amount too high: $${amount}. Maximum allowed is $10,000.`);
      }
      
      logStep('Creating payment intent', { 
        originalAmount: amount, 
        amountInCents: amountInCents,
        chargeType: chargeType 
      });
      
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents, // Now correctly converted to cents
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        description: description,
        payment_method_types: ['card'], // Restrict to card payments only
        metadata: {
          booking_id: bookingId,
          charge_type: chargeType,
          source: 'manual_worker_charge',
          original_amount_dollars: amount.toString() // Track original amount for debugging
        }
      });

      logStep('Payment intent created', { 
        id: paymentIntent.id, 
        status: paymentIntent.status,
        amount: paymentIntent.amount 
      });
    } catch (paymentError) {
      logStep('Payment intent creation failed', { error: paymentError });
      throw new Error(`Payment failed: ${paymentError.message}`);
    }

    if (paymentIntent.status === 'succeeded') {
      logStep('Manual charge successful', { paymentIntentId: paymentIntent.id });
      
      return new Response(
        JSON.stringify({
          success: true,
          payment_intent_id: paymentIntent.id,
          amount_charged: amount, // Return original dollar amount
          amount_charged_cents: Math.round(amount * 100) // Also return cents for verification
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
      logStep('Payment failed with unexpected status', { status: paymentIntent.status });
      throw new Error(`Payment failed with status: ${paymentIntent.status}`)
    }

  } catch (error) {
    logStep('ERROR in process-manual-charge', { error: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
