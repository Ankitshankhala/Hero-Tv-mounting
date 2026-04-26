import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Active Stripe mode. Reads from the `app_settings.stripe_mode` row in the
 * database (single source of truth, can be flipped from the admin UI).
 *
 * Falls back to the STRIPE_MODE env secret, then "live", so production is
 * never accidentally affected if the DB read fails.
 *
 * Cached in-memory per cold-started edge function instance for ~30 seconds
 * to avoid an extra DB round-trip on every payment call.
 */
let _modeCache: { value: 'test' | 'live'; expiresAt: number } | null = null;
const MODE_CACHE_TTL_MS = 30_000;

const readModeFromEnv = (): 'test' | 'live' => {
  const raw = (Deno.env.get('STRIPE_MODE') ?? 'live').toLowerCase().trim();
  return raw === 'test' ? 'test' : 'live';
};

export const getStripeMode = async (): Promise<'test' | 'live'> => {
  const now = Date.now();
  if (_modeCache && _modeCache.expiresAt > now) return _modeCache.value;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    const fallback = readModeFromEnv();
    _modeCache = { value: fallback, expiresAt: now + MODE_CACHE_TTL_MS };
    return fallback;
  }

  try {
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'stripe_mode')
      .maybeSingle();

    if (error) {
      console.warn('[stripe._shared] DB mode read failed, using env fallback:', error.message);
      const fallback = readModeFromEnv();
      _modeCache = { value: fallback, expiresAt: now + MODE_CACHE_TTL_MS };
      return fallback;
    }

    const value = ((data?.value ?? '') as string).toLowerCase().trim();
    const mode: 'test' | 'live' = value === 'test' ? 'test' : 'live';
    _modeCache = { value: mode, expiresAt: now + MODE_CACHE_TTL_MS };
    return mode;
  } catch (e) {
    console.warn('[stripe._shared] DB mode read threw, using env fallback:', e);
    const fallback = readModeFromEnv();
    _modeCache = { value: fallback, expiresAt: now + MODE_CACHE_TTL_MS };
    return fallback;
  }
};

/**
 * Synchronous variant — uses the cache if hydrated, otherwise the env hint.
 * Prefer the async `getStripeMode()` whenever possible.
 */
export const getStripeModeSync = (): 'test' | 'live' => {
  if (_modeCache && _modeCache.expiresAt > Date.now()) return _modeCache.value;
  return readModeFromEnv();
};

/**
 * Returns the Stripe secret key matching the active mode.
 * Throws if the matching key is not configured.
 */
export const getStripeSecretKey = async (): Promise<string> => {
  const mode = await getStripeMode();
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

  if (mode === 'test' && !key.startsWith('sk_test_')) {
    throw new Error('Stripe mode is "test" but STRIPE_SECRET_KEY_TEST is not a test key (sk_test_...)');
  }
  if (mode === 'live' && !key.startsWith('sk_live_')) {
    throw new Error('Stripe mode is "live" but STRIPE_SECRET_KEY is not a live key (sk_live_...)');
  }

  return key;
};

export const createStripeClient = async () => {
  const key = await getStripeSecretKey();
  return new Stripe(key, {
    apiVersion: '2024-12-18.acacia',
  });
};
