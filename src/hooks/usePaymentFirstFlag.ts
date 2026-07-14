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
  const [enabled, setEnabled] = useState(false);
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
          setEnabled(false);
        } else {
          const v = String(data.value ?? '').trim().toLowerCase();
          setEnabled(v === 'true');
        }
      } catch {
        if (!cancelled) setEnabled(false);
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
