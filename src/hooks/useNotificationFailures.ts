import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FailureMap {
  [bookingId: string]: boolean;
}

// Fetch latest notification status per booking within the lookback window
export const useNotificationFailures = (bookingIds: string[], lookbackHours: number = 168) => {
  const [failureMap, setFailureMap] = useState<FailureMap>({});
  const [loading, setLoading] = useState(false);

  const ids = useMemo(() => Array.from(new Set(bookingIds)).filter(Boolean), [bookingIds]);

  const fetchLatestStatuses = useCallback(async () => {
    if (!ids.length) {
      setFailureMap({});
      return;
    }

    setLoading(true);
    try {
      const sinceIso = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('sms_logs')
        .select('booking_id,status,created_at')
        .in('booking_id', ids)
        .gt('created_at', sinceIso)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const latest: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        const bid = row.booking_id;
        if (bid && latest[bid] === undefined) {
          latest[bid] = row.status;
        }
      });

      const map: FailureMap = {};
      ids.forEach((id) => {
        if (latest[id] === 'failed') {
          map[id] = true;
        }
      });

      setFailureMap(map);
    } catch (e) {
      console.error('Error loading failures:', e);
      setFailureMap({});
    } finally {
      setLoading(false);
    }
  }, [ids, lookbackHours]);

  useEffect(() => {
    fetchLatestStatuses();
  }, [fetchLatestStatuses]);

  return { failureMap, loading, refetch: fetchLatestStatuses };
};
