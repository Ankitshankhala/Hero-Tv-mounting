import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

/**
 * Simplified service areas hook that uses database-only operations
 */
export const useSimplifiedServiceAreas = (options: SyncOptions = {}) => {
  const { 
    workerId, 
    enableAutoSync = true, 
    throttleMs = 1000,
    onSyncComplete,
    onSyncError 
  } = options;

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

  // Simplified sync to backend using only database operations
  const syncToBackend = useCallback(async (
    areaId: string,
    workerId: string,
    areaName: string,
    zipCodes: string[],
    polygonPoints?: Array<{ lat: number; lng: number }>
  ): Promise<boolean> => {
    if (!workerId) {
      return false;
    }

    setSyncState(prev => ({ ...prev, isSyncing: true }));

    try {
      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
        body: {
          workerId,
          areaIdToUpdate: areaId,
          areaName,
          zipCodes: zipCodes.length > 0 ? zipCodes : undefined, // Only send if we have ZIP codes
          polygon: polygonPoints || [],
          mode: areaId ? 'update' : 'create'
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
        description: `Service area synchronized successfully`,
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

  // Manual sync trigger
  const triggerSync = useCallback(async (
    areaId: string,
    workerId: string,
    areaName: string,
    polygonPoints: Array<{ lat: number; lng: number }>,
    precomputedZipCodes?: string[]
  ): Promise<boolean> => {
    try {
      // Use pre-computed ZIP codes if provided, otherwise let backend compute from polygon
      return await syncToBackend(
        areaId, 
        workerId, 
        areaName, 
        precomputedZipCodes || [], 
        polygonPoints
      );
    } catch (error) {
      console.error('Manual sync failed:', error);
      return false;
    }
  }, [syncToBackend]);

  return {
    syncState,
    triggerSync,
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