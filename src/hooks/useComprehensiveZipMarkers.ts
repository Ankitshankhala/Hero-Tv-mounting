import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getComprehensiveWorkerZipCoordinates, type ComprehensiveZipCoordinate } from '@/services/comprehensiveZipcodeService';

/**
 * Optimized hook for worker ZIP markers using comprehensive data
 * Eliminates sequential API calls and uses batch database queries
 */
export const useComprehensiveZipMarkers = (workerId?: string) => {
  const [zipCoordinates, setZipCoordinates] = useState<ComprehensiveZipCoordinate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchZipCoordinates = useCallback(async () => {
    if (!workerId) {
      setZipCoordinates([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const coordinates = await getComprehensiveWorkerZipCoordinates(workerId);
      setZipCoordinates(coordinates);
    } catch (err) {
      console.error('Error fetching comprehensive ZIP coordinates:', err);
      setError('Failed to load ZIP coordinates');
      setZipCoordinates([]);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    fetchZipCoordinates();
  }, [fetchZipCoordinates]);

  // Listen for real-time updates to worker service areas
  useEffect(() => {
    if (!workerId) return;

    const channel = supabase
      .channel('comprehensive-zip-markers')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_service_zipcodes',
          filter: `worker_id=eq.${workerId}`
        },
        () => {
          fetchZipCoordinates();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_service_areas',
          filter: `worker_id=eq.${workerId}`
        },
        () => {
          fetchZipCoordinates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workerId, fetchZipCoordinates]);

  return {
    zipCoordinates,
    loading,
    error,
    refetch: fetchZipCoordinates
  };
};