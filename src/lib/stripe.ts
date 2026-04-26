// Stripe configuration with runtime test/live mode toggle.
//
// Mode is stored in the `app_settings` DB table (key = "stripe_mode") and
// can be flipped by an admin from the dashboard without a redeploy. The
// mode is hydrated from the DB on app start (see `hydrateStripeMode` called
// from src/main.tsx) and kept in sync via realtime in `useStripeMode`.
//
// Defaults to "live" so production is never accidentally affected if the
// hydration call fails or hasn't run yet.

import { supabase } from "@/integrations/supabase/client";

export type StripeMode = "test" | "live";

const LIVE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";
const TEST_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST ?? "";

// ---- Runtime mode cache --------------------------------------------------

// Optional env hint for first paint before DB hydration completes.
const ENV_MODE_HINT: StripeMode =
  ((import.meta.env.VITE_STRIPE_MODE ?? "live") as string)
    .toLowerCase()
    .trim() === "test"
    ? "test"
    : "live";

let _currentMode: StripeMode = ENV_MODE_HINT;
let _hydrated = false;
const _listeners = new Set<(m: StripeMode) => void>();

const setMode = (mode: StripeMode) => {
  if (_currentMode === mode && _hydrated) return;
  _currentMode = mode;
  _hydrated = true;
  _listeners.forEach((fn) => {
    try {
      fn(mode);
    } catch {
      /* noop */
    }
  });
};

export const getStripeMode = (): StripeMode => _currentMode;

export const onStripeModeChange = (fn: (m: StripeMode) => void) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

export const getStripePublishableKey = (mode: StripeMode = _currentMode): string =>
  mode === "test" ? TEST_KEY : LIVE_KEY;

// ---- Backward-compatible exports ----------------------------------------
//
// Existing call sites (StripeCardElement, useStripePayment, etc.) import
// these symbols directly. We expose them as live getters via a Proxy-ish
// pattern: re-evaluating each access by exporting a getter through a
// const object would break the named-import contract, so instead we keep
// these as the *current* snapshot. Callers that load Stripe at click time
// (which is all of them) will pick up the latest value because hydration
// happens at app boot. For the rare case where a caller captures the value
// at module load, they should switch to `getStripePublishableKey()`.

export let STRIPE_MODE: StripeMode = _currentMode;
export let STRIPE_PUBLISHABLE_KEY: string = getStripePublishableKey(_currentMode);

onStripeModeChange((m) => {
  STRIPE_MODE = m;
  STRIPE_PUBLISHABLE_KEY = getStripePublishableKey(m);
});

// ---- DB hydration --------------------------------------------------------

export const hydrateStripeMode = async (): Promise<StripeMode> => {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "stripe_mode")
      .maybeSingle();

    if (error) {
      console.warn("[stripe] Failed to hydrate mode from DB, using fallback:", error.message);
      return _currentMode;
    }

    const dbMode: StripeMode =
      (data?.value ?? "").toString().toLowerCase().trim() === "test" ? "test" : "live";
    setMode(dbMode);
    return dbMode;
  } catch (e) {
    console.warn("[stripe] hydrateStripeMode threw, using fallback:", e);
    return _currentMode;
  }
};

// Subscribe to realtime changes so any open tab updates instantly when an
// admin flips the toggle elsewhere.
export const subscribeStripeModeRealtime = () => {
  const channel = supabase
    .channel("app_settings:stripe_mode")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_settings", filter: "key=eq.stripe_mode" },
      (payload: any) => {
        const next = (payload?.new?.value ?? "").toString().toLowerCase().trim();
        if (next === "test" || next === "live") setMode(next);
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
};

// ---- Validation ----------------------------------------------------------

export const validateStripeConfig = () => {
  const mode = _currentMode;
  const key = getStripePublishableKey(mode);
  const errors: string[] = [];

  if (!key) {
    errors.push(
      `Stripe publishable key is not configured for mode "${mode}". ` +
        `Set ${mode === "test" ? "VITE_STRIPE_PUBLISHABLE_KEY_TEST" : "VITE_STRIPE_PUBLISHABLE_KEY"} in .env.`,
    );
  }

  if (key && !key.startsWith("pk_")) {
    errors.push("Invalid Stripe publishable key format");
  }

  const isLiveKey = key?.startsWith("pk_live_");
  const isTestKey = key?.startsWith("pk_test_");

  if (key && !isLiveKey && !isTestKey) {
    errors.push("Stripe key must be either live or test key");
  }

  if (mode === "test" && isLiveKey) {
    errors.push("Stripe mode is 'test' but a live publishable key is configured");
  }
  if (mode === "live" && isTestKey) {
    errors.push("Stripe mode is 'live' but a test publishable key is configured");
  }

  return {
    isValid: errors.length === 0,
    errors,
    keyType: isLiveKey ? "live" : isTestKey ? "test" : "unknown",
    mode,
  };
};
