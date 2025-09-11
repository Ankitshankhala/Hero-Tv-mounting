import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { throttle } from '@/utils/performanceOptimizer';

export const useRealtimeServiceAreas = (onUpdate: () => void) => {
  useEffect(() => {
    // Reduce throttle time for faster updates (300ms instead of 500ms)
    const throttledUpdate = throttle(onUpdate, 200); // Even faster for ZIP changes
    
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
          throttledUpdate();
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
          throttledUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(serviceAreasChannel);
    };
  }, [onUpdate]);
};