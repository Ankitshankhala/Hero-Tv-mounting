
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { useErrorMonitoring } from '@/hooks/useErrorMonitoring';
import { Activity, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

export const PerformanceDashboard = () => {
  const { metrics, getStats, clearMetrics, toggleMonitoring, isMonitoring } = usePerformanceMonitoring();
  const { getErrorStats, clearErrors } = useErrorMonitoring();
  
  const performanceStats = getStats();
  const errorStats = getErrorStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance & Monitoring</h2>
        <div className="flex space-x-2">
          <Button
            variant={isMonitoring ? "default" : "outline"}
            onClick={toggleMonitoring}
            size="sm"
          >
            <Activity className="h-4 w-4 mr-2" />
            {isMonitoring ? 'Monitoring Active' : 'Start Monitoring'}
          </Button>
          <Button variant="outline" onClick={clearMetrics} size="sm">
            Clear Metrics
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceStats.averageResponseTime.toFixed(0)}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Across {performanceStats.totalOperations} operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errorStats.last24Hours}
            </div>
            <p className="text-xs text-muted-foreground">
              Errors in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceStats.totalOperations}
            </div>
            <p className="text-xs text-muted-foreground">
              Operations tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monitoring Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={isMonitoring ? "default" : "secondary"}>
              {isMonitoring ? "Active" : "Inactive"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Real-time monitoring
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Slowest Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {performanceStats.slowestOperations.length > 0 ? (
                performanceStats.slowestOperations.map((metric) => (
                  <div key={metric.id} className="flex justify-between items-center">
                    <span className="text-sm">{metric.name}</span>
                    <Badge variant="outline">
                      {metric.duration?.toFixed(0)}ms
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No performance data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(errorStats.byCategory).length > 0 ? (
                Object.entries(errorStats.byCategory).map(([category, count]) => (
                  <div key={category} className="flex justify-between items-center">
                    <span className="text-sm capitalize">{category}</span>
                    <Badge variant="destructive">{count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No errors recorded</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {metrics.slice(-10).reverse().map((metric) => (
              <div key={metric.id} className="flex justify-between items-center text-sm">
                <span>{metric.name}</span>
                <div className="flex items-center space-x-2">
                  {metric.duration && (
                    <Badge variant="outline">
                      {metric.duration.toFixed(0)}ms
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {new Date(metric.startTime).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
