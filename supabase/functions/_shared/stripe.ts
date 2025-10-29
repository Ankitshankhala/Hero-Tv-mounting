import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const createStripeClient = () => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    throw new Error('Stripe secret key not configured');
  }

  return new Stripe(stripeKey, {
    apiVersion: '2024-12-18.acacia',
  });
};
