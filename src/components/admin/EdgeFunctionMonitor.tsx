
import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { useEdgeFunctionMonitoring } from '@/hooks/useEdgeFunctionMonitoring';

export const EdgeFunctionMonitor = () => {
  const {
    functionStatuses,
    metrics,
    isMonitoring,
    runHealthChecks,
    getSystemHealth
  } = useEdgeFunctionMonitoring();

  const systemHealth = getSystemHealth();

  useEffect(() => {
    // Run initial health check on mount
    runHealthChecks();
    
    // Set up periodic health checks every 5 minutes
    const interval = setInterval(runHealthChecks, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [runHealthChecks]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSystemStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Edge Functions Monitoring
          </CardTitle>
          <Button 
            onClick={runHealthChecks} 
            disabled={isMonitoring}
            size="sm"
            variant="outline"
          >
            {isMonitoring ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isMonitoring ? 'Checking...' : 'Refresh All'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border ${getSystemStatusColor(systemHealth.status)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">System Status</p>
                  <p className="text-2xl font-bold">{systemHealth.status.toUpperCase()}</p>
                  <p className="text-xs">{systemHealth.message}</p>
                </div>
                {systemHealth.status === 'healthy' ? (
                  <CheckCircle className="h-8 w-8" />
                ) : systemHealth.status === 'degraded' ? (
                  <AlertTriangle className="h-8 w-8" />
                ) : (
                  <XCircle className="h-8 w-8" />
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Total Functions</p>
                  <p className="text-2xl font-bold text-blue-900">{metrics.totalFunctions}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-green-50 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Healthy</p>
                  <p className="text-2xl font-bold text-green-900">{metrics.healthyFunctions}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-gray-50 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Avg Response</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.averageResponseTime}ms</p>
                </div>
                <Clock className="h-8 w-8 text-gray-600" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Function Status */}
      <Card>
        <CardHeader>
          <CardTitle>Function Status Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All Functions</TabsTrigger>
              <TabsTrigger value="healthy">Healthy ({metrics.healthyFunctions})</TabsTrigger>
              <TabsTrigger value="errors">Errors ({metrics.errorFunctions})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-2">
              {functionStatuses.map((func) => (
                <FunctionStatusCard key={func.name} function={func} />
              ))}
            </TabsContent>
            
            <TabsContent value="healthy" className="space-y-2">
              {functionStatuses.filter(f => f.status === 'healthy').map((func) => (
                <FunctionStatusCard key={func.name} function={func} />
              ))}
            </TabsContent>
            
            <TabsContent value="errors" className="space-y-2">
              {functionStatuses.filter(f => f.status === 'error').map((func) => (
                <FunctionStatusCard key={func.name} function={func} />
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

interface FunctionStatusCardProps {
  function: {
    name: string;
    status: 'healthy' | 'error' | 'unknown';
    lastChecked: Date;
    responseTime?: number;
    error?: string;
  };
}

const FunctionStatusCard = ({ function: func }: FunctionStatusCardProps) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
      <div className="flex items-center space-x-3">
        {func.status === 'healthy' ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
        <div>
          <p className="font-medium">{func.name}</p>
          <p className="text-sm text-gray-500">
            Last checked: {func.lastChecked.toLocaleTimeString()}
          </p>
          {func.error && (
            <p className="text-sm text-red-600 mt-1">{func.error}</p>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {func.responseTime && (
          <span className="text-sm text-gray-500">{func.responseTime}ms</span>
        )}
        {getStatusBadge(func.status)}
      </div>
    </div>
  );
};
