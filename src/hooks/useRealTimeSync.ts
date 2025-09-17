import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealTimeSyncOptions {
  tableName: string;
  workerId?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onError?: (error: any) => void;
  enableBatching?: boolean;
  batchIntervalMs?: number;
}

interface SyncStats {
  connected: boolean;
  lastActivity: number | null;
  messagesReceived: number;
  errorsCount: number;
  batchedUpdates: number;
}

export const useRealTimeSync = (options: RealTimeSyncOptions) => {
  const {
    tableName,
    workerId,
    onInsert,
    onUpdate,
    onDelete,
    onError,
    enableBatching = true,
    batchIntervalMs = 500
  } = options;

  const [stats, setStats] = useState<SyncStats>({
    connected: false,
    lastActivity: null,
    messagesReceived: 0,
    errorsCount: 0,
    batchedUpdates: 0
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const batchQueueRef = useRef<any[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process batched updates
  const processBatch = useCallback(() => {
    if (batchQueueRef.current.length === 0) return;

    const batch = [...batchQueueRef.current];
    batchQueueRef.current = [];

    setStats(prev => ({
      ...prev,
      batchedUpdates: prev.batchedUpdates + batch.length
    }));

    // Group by event type
    const inserts = batch.filter(item => item.eventType === 'INSERT');
    const updates = batch.filter(item => item.eventType === 'UPDATE');
    const deletes = batch.filter(item => item.eventType === 'DELETE');

    // Process each type
    if (inserts.length > 0 && onInsert) {
      inserts.forEach(item => onInsert(item.payload));
    }
    if (updates.length > 0 && onUpdate) {
      updates.forEach(item => onUpdate(item.payload));
    }
    if (deletes.length > 0 && onDelete) {
      deletes.forEach(item => onDelete(item.payload));
    }
  }, [onInsert, onUpdate, onDelete]);

  // Add to batch queue
  const addToBatch = useCallback((eventType: string, payload: any) => {
    batchQueueRef.current.push({ eventType, payload });

    if (enableBatching) {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      batchTimeoutRef.current = setTimeout(processBatch, batchIntervalMs);
    } else {
      processBatch();
    }
  }, [enableBatching, batchIntervalMs, processBatch]);

  // Create and configure channel
  const createChannel = useCallback(() => {
    try {
      const channelName = `${tableName}-sync-${workerId || 'global'}`;
      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: `sync-${tableName}` }
        }
      });

      // Configure postgres changes listener
      const config: any = {
        event: '*',
        schema: 'public',
        table: tableName
      };

      // Add worker filter if specified
      if (workerId) {
        config.filter = `worker_id=eq.${workerId}`;
      }

      channel.on('postgres_changes', config, (payload) => {
        setStats(prev => ({
          ...prev,
          messagesReceived: prev.messagesReceived + 1,
          lastActivity: Date.now()
        }));

        addToBatch(payload.eventType, payload);
      });

      // Subscribe with status tracking
      channel.subscribe((status) => {
        setStats(prev => ({ ...prev, connected: status === 'SUBSCRIBED' }));

        if (status === 'SUBSCRIBED') {
          console.log(`✅ Real-time sync active for ${tableName}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStats(prev => ({ ...prev, errorsCount: prev.errorsCount + 1 }));
          onError?.(new Error(`Channel ${status.toLowerCase()}`));
          
          // Auto-reconnect after delay
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`🔄 Reconnecting ${tableName} sync...`);
            cleanup();
            createChannel();
          }, 5000);
        }
      });

      channelRef.current = channel;
    } catch (error) {
      console.error(`❌ Failed to create ${tableName} sync channel:`, error);
      onError?.(error);
    }
  }, [tableName, workerId, addToBatch, onError]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStats(prev => ({ ...prev, connected: false }));
  }, []);

  // Initialize channel
  useEffect(() => {
    createChannel();
    return cleanup;
  }, [createChannel, cleanup]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    cleanup();
    setTimeout(createChannel, 1000);
  }, [cleanup, createChannel]);

  // Force process pending batch
  const flushBatch = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    processBatch();
  }, [processBatch]);

  return {
    stats,
    reconnect,
    flushBatch,
    isHealthy: stats.connected && stats.errorsCount < 3
  };
};