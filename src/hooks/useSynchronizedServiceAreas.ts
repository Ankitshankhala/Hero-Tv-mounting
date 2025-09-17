import { useEffect, useRef, useCallback, useState } from 'react';
import { useClientSpatialOperations } from '@/utils/clientSpatialOperations';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { optimizedSupabaseCall } from '@/utils/optimizedApi';

interface SyncOptions {
  workerId?: string;
  enableAutoSync?: boolean;
  throttleMs?: number;
  onSyncComplete?: (zips: string[]) => void;
  onSyncError?: (error: Error) => void;
}

interface SyncState {
  isComputing: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  computedZips: string[];
  syncedZips: string[];
  progress: number;
  errors: string[];
}

export const useSynchronizedServiceAreas = (options: SyncOptions = {}) => {
  const { 
    workerId, 
    enableAutoSync = true, 
    throttleMs = 1000,
    onSyncComplete,
    onSyncError 
  } = options;

  const clientSpatial = useClientSpatialOperations();
  const { toast } = useToast();
  
  const [syncState, setSyncState] = useState<SyncState>({
    isComputing: false,
    isSyncing: false,
    lastSyncTime: null,
    computedZips: [],
    syncedZips: [],
    progress: 0,
    errors: []
  });

  const syncQueueRef = useRef<{
    areaId: string;
    workerId: string;
    areaName: string;
    polygonPoints: Array<{ lat: number; lng: number }>;
  }[]>([]);

  const throttleRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronized ZIP code computation with progress tracking
  const computeZipCodes = useCallback(async (
    polygonPoints: Array<{ lat: number; lng: number }>,
    options?: { includePartial?: boolean; minIntersectionRatio?: number }
  ): Promise<string[]> => {
    setSyncState(prev => ({ ...prev, isComputing: true, progress: 0, errors: [] }));

    try {
      // Ensure ZCTA data is loaded
      await clientSpatial.ensureDataLoaded();
      setSyncState(prev => ({ ...prev, progress: 25 }));

      // Find intersecting ZIP codes
      const results = await clientSpatial.findIntersectingZipcodes(polygonPoints, options);
      setSyncState(prev => ({ ...prev, progress: 75 }));

      const zipCodes = results.map(r => r.zipcode);
      setSyncState(prev => ({ 
        ...prev, 
        computedZips: zipCodes,
        progress: 100,
        isComputing: false
      }));

      return zipCodes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncState(prev => ({ 
        ...prev, 
        errors: [...prev.errors, errorMessage],
        isComputing: false,
        progress: 0
      }));
      throw error;
    }
  }, [clientSpatial]);

  // Sync computed ZIP codes to backend
  const syncToBackend = useCallback(async (
    areaId: string,
    workerId: string,
    areaName: string,
    zipCodes: string[],
    polygonPoints?: Array<{ lat: number; lng: number }>
  ): Promise<boolean> => {
    if (!workerId || zipCodes.length === 0) {
      return false;
    }

    setSyncState(prev => ({ ...prev, isSyncing: true }));

    try {
      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
        body: {
          workerId,
          areaIdToUpdate: areaId,
          areaName,
          zipCodes: zipCodes, // Correct parameter name
          polygon: polygonPoints || [], // Include polygon data for edge function
          mode: areaId ? 'update' : 'create',
          syncTimestamp: Date.now()
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setSyncState(prev => ({ 
        ...prev, 
        isSyncing: false,
        syncedZips: zipCodes,
        lastSyncTime: Date.now(),
        errors: []
      }));

      onSyncComplete?.(zipCodes);

      toast({
        title: "Sync Complete",
        description: `${zipCodes.length} ZIP codes synchronized successfully`,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncState(prev => ({ 
        ...prev, 
        isSyncing: false,
        errors: [...prev.errors, errorMessage]
      }));

      onSyncError?.(error instanceof Error ? error : new Error(errorMessage));

      toast({
        title: "Sync Failed",
        description: errorMessage,
        variant: "destructive"
      });

      return false;
    }
  }, [onSyncComplete, onSyncError, toast]);

  // Throttled sync operation
  const queueSync = useCallback((
    areaId: string,
    workerId: string,
    areaName: string,
    polygonPoints: Array<{ lat: number; lng: number }>
  ) => {
    // Add to queue
    syncQueueRef.current.push({ areaId, workerId, areaName, polygonPoints });

    // Clear existing throttle
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
    }

    // Set new throttled sync
    throttleRef.current = setTimeout(async () => {
      const queue = [...syncQueueRef.current];
      syncQueueRef.current = [];

      // Process the most recent item in queue
      const lastItem = queue[queue.length - 1];
      if (lastItem) {
        try {
          const zipCodes = await computeZipCodes(lastItem.polygonPoints);
          await syncToBackend(lastItem.areaId, lastItem.workerId, lastItem.areaName, zipCodes, lastItem.polygonPoints);
        } catch (error) {
          console.error('Queued sync failed:', error);
        }
      }
    }, throttleMs);
  }, [computeZipCodes, syncToBackend, throttleMs]);

  // Auto-sync when polygon changes
  const handlePolygonChange = useCallback((
    areaId: string,
    workerId: string,
    areaName: string,
    polygonPoints: Array<{ lat: number; lng: number }>
  ) => {
    if (!enableAutoSync || !workerId || polygonPoints.length < 3) {
      return;
    }

    queueSync(areaId, workerId, areaName, polygonPoints);
  }, [enableAutoSync, queueSync]);

  // Manual sync trigger
  const triggerSync = useCallback(async (
    areaId: string,
    workerId: string,
    areaName: string,
    polygonPoints: Array<{ lat: number; lng: number }>
  ): Promise<boolean> => {
    try {
      const zipCodes = await computeZipCodes(polygonPoints);
      return await syncToBackend(areaId, workerId, areaName, zipCodes, polygonPoints);
    } catch (error) {
      console.error('Manual sync failed:', error);
      return false;
    }
  }, [computeZipCodes, syncToBackend]);

  // Validate sync state
  const validateSyncState = useCallback(async (
    areaId: string,
    expectedZipCount?: number
  ): Promise<boolean> => {
    try {
      const result = await optimizedSupabaseCall(
        `service-area-validation-${areaId}`,
        async () => {
          const { data, error } = await supabase
            .from('worker_service_zipcodes')
            .select('zipcode', { count: 'exact' })
            .eq('service_area_id', areaId);
          
          return { data, error };
        },
        true,
        5000 // 5 second cache
      );

      if (result.error) {
        throw result.error;
      }

      const actualCount = result.data?.length || 0;
      const isValid = expectedZipCount ? actualCount === expectedZipCount : actualCount > 0;

      setSyncState(prev => ({
        ...prev,
        errors: isValid ? [] : [`Expected ${expectedZipCount} ZIP codes, found ${actualCount}`]
      }));

      return isValid;
    } catch (error) {
      console.error('Sync validation failed:', error);
      return false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, []);

  return {
    syncState,
    computeZipCodes,
    handlePolygonChange,
    triggerSync,
    validateSyncState,
    clearErrors: () => setSyncState(prev => ({ ...prev, errors: [] })),
    resetState: () => setSyncState({
      isComputing: false,
      isSyncing: false,
      lastSyncTime: null,
      computedZips: [],
      syncedZips: [],
      progress: 0,
      errors: []
    })
  };
};