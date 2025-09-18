import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWorkerZipCoordinatesBatch } from '@/services/optimizedZipcodeService';

interface ZipCoordinate {
  zipcode: string;
  latitude: number;
  longitude: number;
  city: string;
  state_abbr: string;
}

// Optimized hook that uses batch loading and eliminates sequential API calls
export const useOptimizedZipMarkers = (workerId?: string) => {
  const [zipCoordinates, setZipCoordinates] = useState<ZipCoordinate[]>([]);
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
      // Use optimized batch function that gets everything in one query
      const coordinates = await getWorkerZipCoordinatesBatch(workerId);
      setZipCoordinates(coordinates);
    } catch (err) {
      console.error('Error fetching ZIP coordinates:', err);
      setError('Failed to load ZIP coordinates');
      setZipCoordinates([]);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    fetchZipCoordinates();
  }, [fetchZipCoordinates]);

  // Listen for real-time updates
  useEffect(() => {
    if (!workerId) return;

    const channel = supabase
      .channel('optimized-zip-markers')
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