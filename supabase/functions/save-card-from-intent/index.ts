import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SAVE-CARD-FROM-INTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    logStep('Function started');

    const { paymentIntentId, userId } = await req.json()

    if (!paymentIntentId || !userId) {
      throw new Error('Payment intent ID and user ID are required');
    }

    logStep('Processing payment intent', { paymentIntentId, userId });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    
    if (!paymentIntent.payment_method) {
      throw new Error('No payment method attached to payment intent');
    }

    logStep('Payment intent retrieved', { 
      status: paymentIntent.status, 
      paymentMethodId: paymentIntent.payment_method 
    });

    // Only save card if payment intent was successfully authorized or succeeded
    if (!['requires_capture', 'succeeded'].includes(paymentIntent.status)) {
      logStep('Payment intent not in correct state for saving card', { status: paymentIntent.status });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Payment intent not authorized - card not saved' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get the user to check if they already have a saved card
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_default_payment_method_id, has_saved_card')
      .eq('id', userId)
      .single()

    if (userError) {
      throw new Error(`Failed to fetch user: ${userError.message}`);
    }

    // If user already has this payment method saved, no need to save again
    if (user.stripe_default_payment_method_id === paymentIntent.payment_method) {
      logStep('Payment method already saved for user');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Card already saved',
          alreadySaved: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let customerId = user.stripe_customer_id;

    // Create Stripe customer if they don't have one
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { user_id: userId }
      });
      customerId = customer.id;
      logStep('Created new Stripe customer', { customerId });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentIntent.payment_method as string, {
      customer: customerId,
    });

    logStep('Payment method attached to customer');

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentIntent.payment_method as string,
      },
    });

    logStep('Set as default payment method');

    // Update user record with Stripe information
    const { error: updateError } = await supabase
      .from('users')
      .update({
        stripe_customer_id: customerId,
        stripe_default_payment_method_id: paymentIntent.payment_method as string,
        has_saved_card: true
      })
      .eq('id', userId)

    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    logStep('User record updated with card information');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Card saved successfully for future use',
        customerId,
        paymentMethodId: paymentIntent.payment_method
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    logStep('ERROR', { message: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})