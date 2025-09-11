import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ZipCoordinate {
  zipcode: string;
  latitude: number;
  longitude: number;
  city: string;
}

export const useRealtimeZipMarkers = (workerId?: string) => {
  const [zipCoordinates, setZipCoordinates] = useState<ZipCoordinate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchZipCoordinates = async () => {
    if (!workerId) return;

    setLoading(true);
    try {
      // Get worker's ZIP codes
      const { data: workerZips, error: zipError } = await supabase
        .from('worker_service_zipcodes')
        .select('zipcode')
        .eq('worker_id', workerId);

      if (zipError || !workerZips?.length) {
        setZipCoordinates([]);
        return;
      }

      const zipCodes = workerZips.map(z => z.zipcode);

      // Get coordinates for these ZIP codes
      const { data: zipData, error: coordError } = await supabase
        .from('us_zip_codes')
        .select('zipcode, latitude, longitude, city')
        .in('zipcode', zipCodes);

      if (coordError) {
        console.error('Error fetching ZIP coordinates:', coordError);
        setZipCoordinates([]);
        return;
      }

      setZipCoordinates(zipData || []);
    } catch (error) {
      console.error('Error fetching ZIP coordinates:', error);
      setZipCoordinates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZipCoordinates();
  }, [workerId]);

  // Listen for real-time updates
  useEffect(() => {
    if (!workerId) return;

    const channel = supabase
      .channel('zip-markers-updates')
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
  }, [workerId]);

  return {
    zipCoordinates,
    loading,
    refetch: fetchZipCoordinates
  };
};