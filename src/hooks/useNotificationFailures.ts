import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FailureMap {
  [bookingId: string]: boolean;
}

// Fetch recent failed notification logs for a set of bookings in one query
export const useNotificationFailures = (bookingIds: string[], lookbackHours: number = 168) => {
  const [failureMap, setFailureMap] = useState<FailureMap>({});
  const [loading, setLoading] = useState(false);

  const ids = useMemo(() => Array.from(new Set(bookingIds)).filter(Boolean), [bookingIds]);

  useEffect(() => {
    if (!ids.length) {
      setFailureMap({});
      return;
    }

    let cancelled = false;
    const fetchFailures = async () => {
      setLoading(true);
      try {
        const sinceIso = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('sms_logs')
          .select('booking_id,status,created_at')
          .in('booking_id', ids)
          .eq('status', 'failed')
          .gt('created_at', sinceIso);

        if (error) {
          console.error('Failed to load notification failures:', error);
          if (!cancelled) setFailureMap({});
          return;
        }

        const map: FailureMap = {};
        (data || []).forEach((row: any) => {
          if (row.booking_id) map[row.booking_id] = true;
        });
        if (!cancelled) setFailureMap(map);
      } catch (e) {
        console.error('Error loading failures:', e);
        if (!cancelled) setFailureMap({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFailures();
    return () => {
      cancelled = true;
    };
  }, [ids, lookbackHours]);

  return { failureMap, loading };
};
