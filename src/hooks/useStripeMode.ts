import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getStripeMode,
  getStripePublishableKey,
  hydrateStripeMode,
  onStripeModeChange,
  type StripeMode,
} from "@/lib/stripe";

interface UseStripeModeResult {
  mode: StripeMode;
  publishableKey: string;
  loading: boolean;
  /** Admin-only: switch the active mode. Throws on RLS / non-admin. */
  setMode: (next: StripeMode) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Reactive subscription to the Stripe mode stored in `app_settings`.
 * Live-updates across tabs via Supabase realtime.
 */
export const useStripeMode = (): UseStripeModeResult => {
  const [mode, setLocalMode] = useState<StripeMode>(getStripeMode());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onStripeModeChange((m) => setLocalMode(m));
    hydrateStripeMode()
      .then((m) => setLocalMode(m))
      .finally(() => setLoading(false));
    return () => {
      unsub();
    };
  }, []);

  const refresh = useCallback(async () => {
    const m = await hydrateStripeMode();
    setLocalMode(m);
  }, []);

  const setMode = useCallback(async (next: StripeMode) => {
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp?.user?.id ?? null;

    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "stripe_mode", value: next, updated_by: userId },
        { onConflict: "key" },
      );

    if (error) throw error;
    // Optimistic — realtime will also fire.
    setLocalMode(next);
  }, []);

  return {
    mode,
    publishableKey: getStripePublishableKey(mode),
    loading,
    setMode,
    refresh,
  };
};
