
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Monitor, 
  Database, 
  Wifi, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  Activity,
  Clock
} from 'lucide-react';
import { useSystemMonitoring } from '@/hooks/useSystemMonitoring';
import { EdgeFunctionMonitor } from './EdgeFunctionMonitor';

export const SystemMonitoringDashboard = () => {
  const {
    metrics,
    alerts,
    isMonitoring,
    runSystemHealthCheck,
    resolveAlert,
    getSystemStatus
  } = useSystemMonitoring();

  const systemStatus = getSystemStatus();
  const unresolvedAlerts = alerts.filter(alert => !alert.resolved);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'testing':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-600" />
            System Monitoring Dashboard
          </CardTitle>
          <Button 
            onClick={runSystemHealthCheck} 
            disabled={isMonitoring}
            size="sm"
            variant="outline"
          >
            {isMonitoring ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isMonitoring ? 'Checking...' : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border ${getStatusColor(systemStatus.status)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Overall Status</p>
                  <p className="text-lg font-bold">{systemStatus.status.toUpperCase()}</p>
                  <p className="text-xs">{systemStatus.message}</p>
                </div>
                {getStatusIcon(systemStatus.status)}
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Database</p>
                  <p className="text-lg font-bold text-blue-900">
                    {metrics.dbConnectionStatus === 'connected' ? 'Connected' : 
                     metrics.dbConnectionStatus === 'testing' ? 'Testing...' : 'Error'}
                  </p>
                </div>
                <Database className={`h-6 w-6 ${
                  metrics.dbConnectionStatus === 'connected' ? 'text-green-500' :
                  metrics.dbConnectionStatus === 'testing' ? 'text-blue-500' : 'text-red-500'
                }`} />
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-purple-50 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">Realtime</p>
                  <p className="text-lg font-bold text-purple-900">
                    {metrics.realtimeStatus === 'connected' ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <Wifi className={`h-6 w-6 ${
                  metrics.realtimeStatus === 'connected' ? 'text-green-500' : 'text-red-500'
                }`} />
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-gray-50 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Active Alerts</p>
                  <p className="text-lg font-bold text-gray-900">{unresolvedAlerts.length}</p>
                </div>
                <AlertCircle className={`h-6 w-6 ${
                  unresolvedAlerts.length === 0 ? 'text-green-500' : 'text-red-500'
                }`} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      {unresolvedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Active Alerts ({unresolvedAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {unresolvedAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={alert.type === 'error' ? 'destructive' : 'secondary'}>
                          {alert.type}
                        </Badge>
                        <span className="font-medium">{alert.title}</span>
                      </div>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {alert.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Resolve
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Edge Functions Monitoring */}
      <EdgeFunctionMonitor />

      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            System Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Total Requests</p>
                  <p className="text-2xl font-bold">{metrics.totalRequests.toLocaleString()}</p>
                </div>
                <Activity className="h-6 w-6 text-blue-500" />
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Error Rate</p>
                  <p className="text-2xl font-bold">{metrics.errorRate.toFixed(2)}%</p>
                </div>
                <AlertCircle className={`h-6 w-6 ${
                  metrics.errorRate > 5 ? 'text-red-500' : 'text-green-500'
                }`} />
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Avg Response Time</p>
                  <p className="text-2xl font-bold">{metrics.averageResponseTime}ms</p>
                </div>
                <Clock className="h-6 w-6 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Last updated: {metrics.lastUpdated.toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
