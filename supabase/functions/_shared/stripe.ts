import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Active Stripe mode. The runtime source of truth is the
 * `app_settings.stripe_mode` row in the database (single source of truth,
 * flippable from the admin UI). The DB value is hydrated into a per-instance
 * cache by `refreshStripeMode()`. All synchronous getters below read from
 * that cache, falling back to the STRIPE_MODE env secret, then "live", so
 * production is never accidentally affected.
 *
 * Each edge function should call `await refreshStripeMode()` once near the
 * top of its handler before any Stripe call to make sure the cache is fresh.
 * The cache lives ~30 seconds per warm instance to avoid extra DB hits.
 */
let _modeCache: { value: 'test' | 'live'; expiresAt: number } | null = null;
const MODE_CACHE_TTL_MS = 30_000;

const readModeFromEnv = (): 'test' | 'live' => {
  const raw = (Deno.env.get('STRIPE_MODE') ?? 'live').toLowerCase().trim();
  return raw === 'test' ? 'test' : 'live';
};

/**
 * Synchronous mode getter — uses the in-memory cache if hydrated, otherwise
 * the env-secret fallback. Safe to call from anywhere; existing call sites
 * that used the original sync `getStripeMode()` continue to work unchanged.
 */
export const getStripeMode = (): 'test' | 'live' => {
  if (_modeCache && _modeCache.expiresAt > Date.now()) return _modeCache.value;
  return readModeFromEnv();
};

/**
 * Hydrates the in-memory mode cache from the DB. Call this once at the top
 * of each edge function handler so the cache is fresh for the rest of the
 * request. Safe to skip — synchronous getters fall back to the env hint.
 */
export const refreshStripeMode = async (): Promise<'test' | 'live'> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const now = Date.now();

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
 * Returns the Stripe secret key matching the active mode (cached).
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

  if (mode === 'test' && !key.startsWith('sk_test_')) {
    throw new Error('Stripe mode is "test" but STRIPE_SECRET_KEY_TEST is not a test key (sk_test_...)');
  }
  if (mode === 'live' && !key.startsWith('sk_live_')) {
    throw new Error('Stripe mode is "live" but STRIPE_SECRET_KEY is not a live key (sk_live_...)');
  }

  return key;
};

export const createStripeClient = (): Stripe => {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: '2024-12-18.acacia',
  });
};
