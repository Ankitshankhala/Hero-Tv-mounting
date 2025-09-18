import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ZipCoordinate {
  zipcode: string;
  latitude: number;
  longitude: number;
  city: string;
}

// Geocode a ZIP code using Zippopotam.us API
const geocodeZipcode = async (zipcode: string): Promise<ZipCoordinate | null> => {
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zipcode}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    const place = data.places?.[0];
    if (!place) return null;
    
    return {
      zipcode,
      latitude: parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
      city: place['place name'] || 'Unknown'
    };
  } catch (error) {
    console.warn(`Failed to geocode ZIP ${zipcode}:`, error);
    return null;
  }
};

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

      // Try to get coordinates from the us_zip_codes table
      const { data: zipData, error: coordError } = await supabase
        .from('us_zip_codes')
        .select('zipcode, latitude, longitude, city')
        .in('zipcode', zipCodes)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (coordError) {
        console.error('Error fetching ZIP coordinates:', coordError);
        setZipCoordinates([]);
        return;
      }

      const foundZips = zipData || [];
      const missingZips = zipCodes.filter(zip => 
        !foundZips.some(found => found.zipcode === zip)
      );

      // Only geocode truly missing ZIPs, with better batching
      const geocodedZips: ZipCoordinate[] = [];
      if (missingZips.length > 0) {
        // Process in smaller batches to avoid rate limits
        for (let i = 0; i < missingZips.length; i += 3) {
          const batch = missingZips.slice(i, i + 3);
          const batchResults = await Promise.all(
            batch.map(zip => geocodeZipcode(zip))
          );
          geocodedZips.push(...batchResults.filter(Boolean) as ZipCoordinate[]);
          
          // Add delay between batches to respect rate limits
          if (i + 3 < missingZips.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }

      // Combine database and geocoded results
      const allCoordinates = [
        ...foundZips.map(z => ({
          zipcode: z.zipcode,
          latitude: z.latitude,
          longitude: z.longitude,
          city: z.city
        })),
        ...geocodedZips
      ];

      setZipCoordinates(allCoordinates);
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