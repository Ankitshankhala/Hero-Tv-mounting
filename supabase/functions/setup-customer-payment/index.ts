import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createStripeClient, corsHeaders } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = createStripeClient();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { bookingId, customerEmail, customerName, paymentMethodId } = await req.json();

    console.log('Setting up customer payment method:', {
      bookingId,
      customerEmail,
      paymentMethodId
    });

    // Check if customer already exists in our database
    const { data: existingCustomer } = await supabaseClient
      .from('stripe_customers')
      .select('*')
      .eq('email', customerEmail)
      .single();

    let stripeCustomerId: string;
    let dbCustomerId: string;

    if (existingCustomer) {
      console.log('Found existing customer:', existingCustomer.stripe_customer_id);
      stripeCustomerId = existingCustomer.stripe_customer_id;
      dbCustomerId = existingCustomer.id;
    } else {
      // Create new Stripe customer
      console.log('Creating new Stripe customer');
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: {
          booking_id: bookingId,
        },
      });

      stripeCustomerId = customer.id;

      // Store customer in database
      const { data: newCustomer, error: insertError } = await supabaseClient
        .from('stripe_customers')
        .insert({
          email: customerEmail,
          name: customerName,
          stripe_customer_id: customer.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing customer:', insertError);
        throw insertError;
      }

      dbCustomerId = newCustomer.id;
      console.log('Created new customer:', stripeCustomerId);
    }

    // Attach payment method to customer
    console.log('Attaching payment method to customer');
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update database with default payment method
    await supabaseClient
      .from('stripe_customers')
      .update({
        stripe_default_payment_method_id: paymentMethodId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dbCustomerId);

    // Update booking with customer and payment method info
    await supabaseClient
      .from('bookings')
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_payment_method_id: paymentMethodId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    console.log('Payment method setup complete');

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: stripeCustomerId,
        payment_method_id: paymentMethodId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error setting up customer payment:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to setup customer payment',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
