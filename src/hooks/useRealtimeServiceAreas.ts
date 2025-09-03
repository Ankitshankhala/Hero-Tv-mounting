import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeServiceAreas = (onUpdate: () => void) => {
  useEffect(() => {
    // Subscribe to changes in worker_service_areas table
    const serviceAreasChannel = supabase
      .channel('service-areas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_service_areas'
        },
        (payload) => {
          console.log('Service areas change detected:', payload);
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_service_zipcodes'
        },
        (payload) => {
          console.log('Service zip codes change detected:', payload);
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(serviceAreasChannel);
    };
  }, [onUpdate]);
};