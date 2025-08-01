
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

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Processing manual charge:', { bookingId, customerId, amount, chargeType })

    // Get booking info to find customer
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('customer_id, guest_customer_info, stripe_customer_id')
      .eq('id', bookingId)
      .single()

    if (bookingError) {
      throw new Error(`Failed to fetch booking: ${bookingError.message}`)
    }

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
      } else if (booking.guest_customer_info) {
        // Get customer from guest info
        customerEmail = booking.guest_customer_info.email
        customerName = booking.guest_customer_info.name
      }

      if (customerEmail) {
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

        // Update booking with Stripe customer ID
        await supabase
          .from('bookings')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', bookingId)
      }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount should already be in cents
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      description: description,
      metadata: {
        booking_id: bookingId,
        charge_type: chargeType,
        source: 'manual_worker_charge'
      }
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
