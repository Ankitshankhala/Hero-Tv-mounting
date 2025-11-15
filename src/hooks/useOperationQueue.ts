import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface QueuedOperation<T = any> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

/**
 * Hook to manage a queue of async operations, ensuring only one runs at a time
 * Prevents race conditions when multiple operations are triggered rapidly
 */
export const useOperationQueue = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const queueRef = useRef<QueuedOperation[]>([]);
  const { toast } = useToast();

  const processQueue = useCallback(async () => {
    if (queueRef.current.length === 0 || isProcessing) {
      return;
    }

    setIsProcessing(true);
    const operation = queueRef.current[0];

    try {
      const result = await operation.execute();
      operation.resolve(result);
    } catch (error) {
      console.error('Queue operation failed:', error);
      operation.reject(error);
    } finally {
      // Remove completed operation
      queueRef.current.shift();
      setQueueLength(queueRef.current.length);
      setIsProcessing(false);

      // Process next operation if any
      if (queueRef.current.length > 0) {
        setTimeout(() => processQueue(), 100); // Small delay between operations
      }
    }
  }, [isProcessing]);

  const enqueue = useCallback(<T,>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const id = `${Date.now()}-${Math.random()}`;
      
      queueRef.current.push({
        id,
        execute: operation,
        resolve,
        reject,
      });

      setQueueLength(queueRef.current.length);

      // Show feedback if multiple operations are queued
      if (queueRef.current.length > 1) {
        toast({
          title: "Operation Queued",
          description: `${operationName || 'Operation'} added to queue. ${queueRef.current.length} operations pending.`,
        });
      }

      processQueue();
    });
  }, [processQueue, toast]);

  const clearQueue = useCallback(() => {
    queueRef.current.forEach(op => {
      op.reject(new Error('Queue cleared'));
    });
    queueRef.current = [];
    setQueueLength(0);
    setIsProcessing(false);
  }, []);

  return {
    enqueue,
    clearQueue,
    isProcessing,
    queueLength,
  };
};
