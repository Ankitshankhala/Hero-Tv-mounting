
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookingId, customerId, paymentMethodId, amount, chargeType, description } = await req.json()

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    console.log('Processing manual charge:', { bookingId, customerId, amount, chargeType })

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      description: `${description} (Booking: ${bookingId})`,
      metadata: {
        booking_id: bookingId,
        charge_type: chargeType,
        source: 'manual_worker_charge'
      },
      return_url: 'https://your-app.com' // Required for some payment methods
    })

    if (paymentIntent.status === 'succeeded') {
      console.log('Manual charge successful:', paymentIntent.id)
      
      return new Response(
        JSON.stringify({
          success: true,
          payment_intent_id: paymentIntent.id,
          amount_charged: amount
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
      throw new Error(`Payment failed with status: ${paymentIntent.status}`)
    }

  } catch (error) {
    console.error('Error processing manual charge:', error)
    
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
