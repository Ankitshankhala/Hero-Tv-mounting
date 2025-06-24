
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';

interface EdgeFunctionStatus {
  name: string;
  status: 'healthy' | 'error' | 'unknown';
  lastChecked: Date;
  responseTime?: number;
  error?: string;
}

interface EdgeFunctionMetrics {
  totalFunctions: number;
  healthyFunctions: number;
  errorFunctions: number;
  averageResponseTime: number;
}

export const useEdgeFunctionMonitoring = () => {
  const [functionStatuses, setFunctionStatuses] = useState<EdgeFunctionStatus[]>([]);
  const [metrics, setMetrics] = useState<EdgeFunctionMetrics>({
    totalFunctions: 0,
    healthyFunctions: 0,
    errorFunctions: 0,
    averageResponseTime: 0
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const { handleError } = useErrorHandler();

  // List of all edge functions to monitor
  const edgeFunctions = [
    'apply-late-fees',
    'auto-invoice',
    'capture-payment-intent',
    'create-checkout',
    'create-payment-intent',
    'create-payment-link',
    'generate-invoice',
    'get-payment-method-info',
    'notify-workers-coverage',
    'process-manual-charge',
    'process-onsite-payment',
    'process-payment',
    'send-sms-notification',
    'setup-customer-payment',
    'update-booking-payment',
    'verify-payment'
  ];

  const checkFunctionHealth = useCallback(async (functionName: string): Promise<EdgeFunctionStatus> => {
    const startTime = Date.now();
    
    try {
      console.log(`Checking health of edge function: ${functionName}`);
      
      // Create a health check payload based on function type
      let healthCheckPayload = {};
      
      // Customize health check based on function requirements
      if (functionName === 'get-payment-method-info') {
        healthCheckPayload = { paymentMethodId: 'health_check' };
      } else if (functionName === 'process-payment') {
        healthCheckPayload = { bookingId: 'health_check', amount: 0 };
      } else if (functionName === 'send-sms-notification') {
        healthCheckPayload = { phone: '+1234567890', message: 'health_check' };
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { ...healthCheckPayload, healthCheck: true }
      });

      const responseTime = Date.now() - startTime;

      if (error) {
        console.error(`Health check failed for ${functionName}:`, error);
        return {
          name: functionName,
          status: 'error',
          lastChecked: new Date(),
          responseTime,
          error: error.message
        };
      }

      return {
        name: functionName,
        status: 'healthy',
        lastChecked: new Date(),
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`Health check error for ${functionName}:`, error);
      
      return {
        name: functionName,
        status: 'error',
        lastChecked: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  const runHealthChecks = useCallback(async () => {
    setIsMonitoring(true);
    console.log('Starting edge functions health checks...');
    
    try {
      const healthCheckPromises = edgeFunctions.map(functionName => 
        checkFunctionHealth(functionName)
      );

      const results = await Promise.all(healthCheckPromises);
      setFunctionStatuses(results);

      // Calculate metrics
      const healthyCount = results.filter(r => r.status === 'healthy').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      const totalResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0);
      const averageResponseTime = totalResponseTime / results.length;

      const newMetrics: EdgeFunctionMetrics = {
        totalFunctions: results.length,
        healthyFunctions: healthyCount,
        errorFunctions: errorCount,
        averageResponseTime: Math.round(averageResponseTime)
      };

      setMetrics(newMetrics);
      console.log('Health checks completed:', newMetrics);

    } catch (error) {
      handleError(error, 'edge function health checks', {
        toastTitle: 'Health Check Failed',
        fallbackMessage: 'Failed to check edge function health',
        category: 'monitoring'
      });
    } finally {
      setIsMonitoring(false);
    }
  }, [checkFunctionHealth, handleError]);

  const getSystemHealth = useCallback(() => {
    const healthPercentage = metrics.totalFunctions > 0 
      ? (metrics.healthyFunctions / metrics.totalFunctions) * 100 
      : 0;

    let status: 'healthy' | 'degraded' | 'critical';
    if (healthPercentage >= 95) {
      status = 'healthy';
    } else if (healthPercentage >= 80) {
      status = 'degraded';
    } else {
      status = 'critical';
    }

    return {
      status,
      healthPercentage: Math.round(healthPercentage),
      message: `${metrics.healthyFunctions}/${metrics.totalFunctions} functions healthy`
    };
  }, [metrics]);

  return {
    functionStatuses,
    metrics,
    isMonitoring,
    runHealthChecks,
    getSystemHealth,
    edgeFunctions
  };
};
