
import { useState, useCallback, useEffect } from 'react';
import { useErrorMonitoring } from './useErrorMonitoring';

interface PerformanceMetric {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  averageResponseTime: number;
  slowestOperations: PerformanceMetric[];
  totalOperations: number;
  failureRate: number;
}

export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const { logError } = useErrorMonitoring();

  // Monitor Core Web Vitals
  useEffect(() => {
    if (!isMonitoring || typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
          const metric: PerformanceMetric = {
            id: crypto.randomUUID(),
            name: entry.name,
            startTime: entry.startTime,
            endTime: entry.startTime + entry.duration,
            duration: entry.duration,
            metadata: {
              entryType: entry.entryType,
              timestamp: new Date().toISOString()
            }
          };

          setMetrics(prev => [...prev.slice(-49), metric]); // Keep last 50 metrics
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['measure', 'navigation'] });
    } catch (error) {
      logError(error as Error, 'Performance Observer setup');
    }

    return () => observer.disconnect();
  }, [isMonitoring, logError]);

  const startTiming = useCallback((operationName: string, metadata?: Record<string, any>) => {
    const startTime = performance.now();
    const id = crypto.randomUUID();

    const metric: PerformanceMetric = {
      id,
      name: operationName,
      startTime,
      metadata
    };

    setMetrics(prev => [...prev, metric]);
    
    return {
      id,
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        setMetrics(prev => prev.map(m => 
          m.id === id 
            ? { ...m, endTime, duration }
            : m
        ));

        // Log slow operations (> 1 second)
        if (duration > 1000) {
          console.warn(`Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`);
        }

        return duration;
      }
    };
  }, []);

  const measureAsync = useCallback(async (
    operationName: string,
    operation: () => Promise<any>,
    metadata?: Record<string, any>
  ): Promise<any> => {
    const timer = startTiming(operationName, metadata);
    
    try {
      const result = await operation();
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      logError(error as Error, `Performance monitoring - ${operationName}`, {
        category: 'performance',
        ...metadata
      });
      throw error;
    }
  }, [startTiming, logError]);

  const getStats = useCallback((): PerformanceStats => {
    const completedMetrics = metrics.filter(m => m.duration !== undefined);
    const totalOperations = completedMetrics.length;
    
    if (totalOperations === 0) {
      return {
        averageResponseTime: 0,
        slowestOperations: [],
        totalOperations: 0,
        failureRate: 0
      };
    }

    const averageResponseTime = completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / totalOperations;
    const slowestOperations = completedMetrics
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);

    return {
      averageResponseTime,
      slowestOperations,
      totalOperations,
      failureRate: 0 // This would need error tracking integration
    };
  }, [metrics]);

  const clearMetrics = useCallback(() => {
    setMetrics([]);
  }, []);

  const toggleMonitoring = useCallback(() => {
    setIsMonitoring(prev => !prev);
  }, []);

  return {
    metrics,
    startTiming,
    measureAsync,
    getStats,
    clearMetrics,
    toggleMonitoring,
    isMonitoring
  };
};
