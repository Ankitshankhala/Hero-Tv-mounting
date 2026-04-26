import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Active Stripe mode, controlled by the STRIPE_MODE secret.
 * Defaults to "live" so production is never accidentally affected.
 */
export const getStripeMode = (): 'test' | 'live' => {
  const raw = (Deno.env.get('STRIPE_MODE') ?? 'live').toLowerCase().trim();
  return raw === 'test' ? 'test' : 'live';
};

/**
 * Returns the Stripe secret key matching the active mode.
 * Throws if the matching key is not configured.
 */
export const getStripeSecretKey = (): string => {
  const mode = getStripeMode();
  const key =
    mode === 'test'
      ? Deno.env.get('STRIPE_SECRET_KEY_TEST')
      : Deno.env.get('STRIPE_SECRET_KEY');

  if (!key) {
    throw new Error(
      `Stripe secret key not configured for mode "${mode}". ` +
        `Set ${mode === 'test' ? 'STRIPE_SECRET_KEY_TEST' : 'STRIPE_SECRET_KEY'} in Supabase Edge Function Secrets.`
    );
  }

  // Sanity-check: prefix must match mode to avoid silent live<->test cross-wiring.
  if (mode === 'test' && !key.startsWith('sk_test_')) {
    throw new Error('STRIPE_MODE is "test" but STRIPE_SECRET_KEY_TEST is not a test key (sk_test_...)');
  }
  if (mode === 'live' && !key.startsWith('sk_live_')) {
    throw new Error('STRIPE_MODE is "live" but STRIPE_SECRET_KEY is not a live key (sk_live_...)');
  }

  return key;
};

export const createStripeClient = () => {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: '2024-12-18.acacia',
  });
};
