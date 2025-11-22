import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Activity, TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';

interface PerformanceMetrics {
  avgProcessingTime: number;
  p95ProcessingTime: number;
  slowPayments: number;
  totalPayments: number;
  successRate: number;
}

export const PaymentPerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
    
    // Refresh metrics every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      
      // Query recent payment transactions (last 24 hours)
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('created_at, status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (txError) throw txError;

      // Query booking audit logs for performance data
      const { data: auditLogs, error: auditError } = await supabase
        .from('booking_audit_log')
        .select('details, created_at')
        .eq('operation', 'payment_intent_created')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (auditError) throw auditError;

      // Calculate metrics
      const processingTimes: number[] = [];
      let slowCount = 0;
      
      auditLogs?.forEach(log => {
        const details = log.details as any;
        if (details?.performance?.total_ms) {
          const timeMs = details.performance.total_ms;
          processingTimes.push(timeMs);
          if (timeMs > 3000) slowCount++;
        }
      });

      const successCount = transactions?.filter(t => 
        t.status === 'captured' || t.status === 'completed'
      ).length || 0;

      const avgTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

      // Calculate P95
      const sorted = [...processingTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p95Time = sorted[p95Index] || 0;

      setMetrics({
        avgProcessingTime: avgTime,
        p95ProcessingTime: p95Time,
        slowPayments: slowCount,
        totalPayments: transactions?.length || 0,
        successRate: transactions?.length ? (successCount / transactions.length) * 100 : 0,
      });

      setError(null);
    } catch (err: any) {
      console.error('Error loading payment metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Payment Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Loading metrics...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Payment Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isHealthy = metrics && metrics.p95ProcessingTime < 2500;
  const needsAttention = metrics && metrics.p95ProcessingTime >= 2500 && metrics.p95ProcessingTime < 5000;
  const isCritical = metrics && metrics.p95ProcessingTime >= 5000;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Payment Performance (24h)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Alert */}
        {isCritical && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Critical:</strong> Payment processing times are significantly degraded
            </AlertDescription>
          </Alert>
        )}
        
        {needsAttention && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Payment processing times are above target
            </AlertDescription>
          </Alert>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Average Time */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Avg Time
            </div>
            <div className="text-2xl font-bold">
              {metrics ? `${(metrics.avgProcessingTime / 1000).toFixed(2)}s` : '-'}
            </div>
            <div className="text-xs text-muted-foreground">Target: &lt;2s</div>
          </div>

          {/* P95 Time */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              P95 Time
            </div>
            <div className={`text-2xl font-bold ${
              isHealthy ? 'text-green-600' : 
              needsAttention ? 'text-yellow-600' : 
              'text-red-600'
            }`}>
              {metrics ? `${(metrics.p95ProcessingTime / 1000).toFixed(2)}s` : '-'}
            </div>
            <div className="text-xs text-muted-foreground">Target: &lt;2.5s</div>
          </div>

          {/* Success Rate */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              {metrics && metrics.successRate >= 95 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              Success Rate
            </div>
            <div className="text-2xl font-bold">
              {metrics ? `${metrics.successRate.toFixed(1)}%` : '-'}
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics?.totalPayments || 0} payments
            </div>
          </div>

          {/* Slow Payments */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Slow Payments
            </div>
            <div className={`text-2xl font-bold ${
              metrics && metrics.slowPayments === 0 ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {metrics?.slowPayments || 0}
            </div>
            <div className="text-xs text-muted-foreground">&gt;3s processing</div>
          </div>
        </div>

        {/* Performance Status */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Status:</span>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${
              isHealthy ? 'bg-green-100 text-green-800' :
              needsAttention ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {isHealthy ? 'Healthy' : needsAttention ? 'Needs Attention' : 'Critical'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
