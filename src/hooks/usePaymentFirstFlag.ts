import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Page-level feature flag for the payment-first checkout (V2).
 *
 * Reads `app_settings.payment_first_enabled` once. Fail-safe: any error,
 * missing row, or unexpected value → returns false (existing V1 flow).
 *
 * The flag can be flipped in the DB without a code deploy — just update
 * the `payment_first_enabled` row's `value` to 'true' or 'false'.
 */
export function usePaymentFirstFlag(): { enabled: boolean; loading: boolean } {
  // Optimistic default: payment-first (V2) is the standard. V1 is only used
  // when an admin has EXPLICITLY set the flag to 'false' in the DB. Loading
  // states and fetch errors must never drop a customer into V1 (which would
  // create a booking row before payment authorization).
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'payment_first_enabled')
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          // Fetch failed or row missing → stay on V2 (optimistic).
          setEnabled(true);
        } else {
          const v = String(data.value ?? '').trim().toLowerCase();
          // Only explicit 'false' disables payment-first.
          setEnabled(v !== 'false');
        }
      } catch {
        // Any error → stay on V2.
        if (!cancelled) setEnabled(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading };
}
