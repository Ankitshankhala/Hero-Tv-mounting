
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';

interface SystemMetrics {
  dbConnectionStatus: 'connected' | 'error' | 'testing';
  realtimeStatus: 'connected' | 'disconnected';
  edgeFunctionHealth: number;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  lastUpdated: Date;
}

interface SystemAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export const useSystemMonitoring = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    dbConnectionStatus: 'testing',
    realtimeStatus: 'disconnected',
    edgeFunctionHealth: 0,
    totalRequests: 0,
    errorRate: 0,
    averageResponseTime: 0,
    lastUpdated: new Date()
  });
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const { handleError } = useErrorHandler();

  const testDatabaseConnection = useCallback(async () => {
    console.log('Testing database connection...');
    setMetrics(prev => ({ ...prev, dbConnectionStatus: 'testing' }));
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error) {
        console.error('Database connection error:', error);
        setMetrics(prev => ({ ...prev, dbConnectionStatus: 'error' }));
        addAlert({
          type: 'error',
          title: 'Database Connection Failed',
          message: `Unable to connect to database: ${error.message}`
        });
      } else {
        console.log('Database connection successful');
        setMetrics(prev => ({ ...prev, dbConnectionStatus: 'connected' }));
      }
    } catch (error) {
      console.error('Database test failed:', error);
      setMetrics(prev => ({ ...prev, dbConnectionStatus: 'error' }));
      addAlert({
        type: 'error',
        title: 'Database Test Failed',
        message: 'Failed to test database connection'
      });
    }
  }, []);

  const checkRealtimeConnection = useCallback(() => {
    const channel = supabase.channel('system-monitor');
    
    channel
      .on('presence', { event: 'sync' }, () => {
        console.log('Realtime connection established');
        setMetrics(prev => ({ ...prev, realtimeStatus: 'connected' }));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setMetrics(prev => ({ ...prev, realtimeStatus: 'connected' }));
        } else {
          setMetrics(prev => ({ ...prev, realtimeStatus: 'disconnected' }));
        }
      });

    // Clean up after test
    setTimeout(() => {
      supabase.removeChannel(channel);
    }, 5000);
  }, []);

  const addAlert = useCallback((alert: Omit<SystemAlert, 'id' | 'timestamp' | 'resolved'>) => {
    const newAlert: SystemAlert = {
      ...alert,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      resolved: false
    };
    
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)]); // Keep only 10 recent alerts
    console.log('System alert:', newAlert);
  }, []);

  const resolveAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ));
  }, []);

  const runSystemHealthCheck = useCallback(async () => {
    setIsMonitoring(true);
    console.log('Running comprehensive system health check...');
    
    try {
      await Promise.all([
        testDatabaseConnection(),
        checkRealtimeConnection()
      ]);

      setMetrics(prev => ({
        ...prev,
        lastUpdated: new Date()
      }));

      console.log('System health check completed');
    } catch (error) {
      handleError(error, 'system health check', {
        toastTitle: 'System Health Check Failed',
        fallbackMessage: 'Failed to complete system health check',
        category: 'monitoring'
      });
    } finally {
      setIsMonitoring(false);
    }
  }, [testDatabaseConnection, checkRealtimeConnection, handleError]);

  const getSystemStatus = useCallback(() => {
    const { dbConnectionStatus, realtimeStatus, edgeFunctionHealth } = metrics;
    
    if (dbConnectionStatus === 'error') {
      return { status: 'critical', message: 'Database connection failed' };
    }
    
    if (realtimeStatus === 'disconnected') {
      return { status: 'degraded', message: 'Realtime connection issues' };
    }
    
    if (edgeFunctionHealth < 80) {
      return { status: 'degraded', message: 'Edge function issues detected' };
    }
    
    return { status: 'healthy', message: 'All systems operational' };
  }, [metrics]);

  // Auto-run health checks on mount and periodically
  useEffect(() => {
    runSystemHealthCheck();
    
    const interval = setInterval(runSystemHealthCheck, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [runSystemHealthCheck]);

  return {
    metrics,
    alerts,
    isMonitoring,
    runSystemHealthCheck,
    testDatabaseConnection,
    checkRealtimeConnection,
    addAlert,
    resolveAlert,
    getSystemStatus
  };
};
