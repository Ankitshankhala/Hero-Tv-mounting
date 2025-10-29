import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createStripeClient, corsHeaders } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = createStripeClient();

    const { paymentMethodId } = await req.json();

    if (!paymentMethodId) {
      throw new Error('Payment method ID is required');
    }

    console.log('Fetching payment method details:', paymentMethodId);

    // Retrieve payment method details from Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    const cardDetails = {
      last4: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
      exp_month: paymentMethod.card?.exp_month,
      exp_year: paymentMethod.card?.exp_year,
    };

    console.log('Payment method details retrieved successfully');

    return new Response(
      JSON.stringify(cardDetails),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching payment method details:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to fetch payment method details',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
