import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { throttle } from '@/utils/performanceOptimizer';

export const useRealtimeServiceAreas = (onUpdate: () => void) => {
  useEffect(() => {
    // Throttle updates to prevent excessive re-rendering
    const throttledUpdate = throttle(onUpdate, 500);
    
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