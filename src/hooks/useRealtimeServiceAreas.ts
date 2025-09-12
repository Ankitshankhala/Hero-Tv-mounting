import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { throttle } from '@/utils/performanceOptimizer';

interface RealtimeOptions {
  onUpdate: () => void;
  onError?: (error: any) => void;
  enableCacheInvalidation?: boolean;
  throttleMs?: number;
}

export const useRealtimeServiceAreas = (options: RealtimeOptions | (() => void)) => {
  const isFunction = typeof options === 'function';
  const onUpdate = isFunction ? options : options.onUpdate;
  const onError = isFunction ? undefined : options.onError;
  const enableCacheInvalidation = isFunction ? true : (options.enableCacheInvalidation ?? true);
  const throttleMs = isFunction ? 200 : (options.throttleMs ?? 200);

  const lastUpdateRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);
  const maxRetries = 3;

  const handleError = useCallback((error: any, context: string) => {
    console.error(`Realtime error in ${context}:`, error);
    errorCountRef.current += 1;
    
    if (onError) {
      onError(error);
    }

    // Exponential backoff for reconnection
    if (errorCountRef.current <= maxRetries) {
      const delay = Math.pow(2, errorCountRef.current) * 1000;
      setTimeout(() => {
        console.log(`Retrying realtime connection (attempt ${errorCountRef.current})`);
      }, delay);
    }
  }, [onError]);

  const throttledUpdate = useCallback(
    throttle(() => {
      const now = Date.now();
      // Prevent rapid-fire updates (minimum 100ms between updates)
      if (now - lastUpdateRef.current < 100) {
        return;
      }
      lastUpdateRef.current = now;
      
      try {
        onUpdate();
        errorCountRef.current = 0; // Reset error count on successful update
      } catch (error) {
        handleError(error, 'update callback');
      }
    }, throttleMs),
    [onUpdate, throttleMs, handleError]
  );

  useEffect(() => {
    let serviceAreasChannel: any = null;
    let isConnected = false;

    const connect = async () => {
      try {
        // Clear any existing cache if cache invalidation is enabled
        if (enableCacheInvalidation && typeof window !== 'undefined') {
          // Clear relevant caches
          const cacheKeys = ['workers', 'service-areas', 'audit-logs'];
          cacheKeys.forEach(key => {
            localStorage.removeItem(`cache_${key}`);
            sessionStorage.removeItem(`cache_${key}`);
          });
        }

        serviceAreasChannel = supabase
          .channel('service-areas-changes', {
            config: {
              broadcast: { self: false },
              presence: { key: 'service-areas' }
            }
          })
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
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'service_area_audit_logs'
            },
            (payload) => {
              console.log('Service area audit logs change detected:', payload);
              throttledUpdate();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              isConnected = true;
              console.log('Realtime service areas subscription active');
            } else if (status === 'CHANNEL_ERROR') {
              handleError(new Error('Channel subscription failed'), 'subscription');
            } else if (status === 'TIMED_OUT') {
              handleError(new Error('Subscription timed out'), 'subscription');
            } else if (status === 'CLOSED') {
              isConnected = false;
              console.log('Realtime service areas subscription closed');
            }
          });

      } catch (error) {
        handleError(error, 'connection');
      }
    };

    connect();

    // Health check and reconnection logic
    const healthCheckInterval = setInterval(() => {
      if (!isConnected && errorCountRef.current <= maxRetries) {
        console.log('Reconnecting realtime subscription...');
        connect();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(healthCheckInterval);
      if (serviceAreasChannel) {
        supabase.removeChannel(serviceAreasChannel);
      }
    };
  }, [throttledUpdate, handleError, enableCacheInvalidation]);

  // Return connection status and manual refresh function
  return {
    isConnected: errorCountRef.current === 0,
    errorCount: errorCountRef.current,
    refresh: throttledUpdate
  };
};