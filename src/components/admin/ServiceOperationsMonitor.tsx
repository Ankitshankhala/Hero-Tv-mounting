import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Clock, TrendingUp, Users, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface OperationLog {
  id: string;
  booking_id: string;
  worker_id: string | null;
  operation_type: string;
  service_name: string;
  quantity: number;
  status: string;
  error_code: string | null;
  error_message: string | null;
  error_details: any;
  duration_ms: number;
  retry_count: number;
  created_at: string;
}

interface Analytics {
  time_bucket: string;
  operation_type: string;
  status: string;
  operation_count: number;
  avg_duration_ms: number;
  unique_workers: number;
  unique_bookings: number;
  operations_with_retries: number;
}

export const ServiceOperationsMonitor = () => {
  const [failedOps, setFailedOps] = useState<OperationLog[]>([]);
  const [recentOps, setRecentOps] = useState<OperationLog[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('service-operations-monitor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'service_operation_logs'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch failed operations
      const { data: failed } = await supabase
        .from('service_operation_logs')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch recent operations
      const { data: recent } = await supabase
        .from('service_operation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Fetch analytics
      const { data: analyticsData } = await supabase
        .from('v_service_operation_analytics')
        .select('*')
        .order('time_bucket', { ascending: false })
        .limit(24);

      setFailedOps(failed || []);
      setRecentOps(recent || []);
      setAnalytics(analyticsData || []);
    } catch (error) {
      console.error('Error fetching service operations data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'retried':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Clock className="w-3 h-3 mr-1" />Retried</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const calculateMetrics = () => {
    const last24h = recentOps.filter(op => {
      const opTime = new Date(op.created_at).getTime();
      const now = Date.now();
      return now - opTime < 24 * 60 * 60 * 1000;
    });

    const totalOps = last24h.length;
    const successOps = last24h.filter(op => op.status === 'success').length;
    const failedOps = last24h.filter(op => op.status === 'failed').length;
    const retriedOps = last24h.filter(op => op.status === 'retried').length;
    const successRate = totalOps > 0 ? ((successOps / totalOps) * 100).toFixed(1) : '0.0';
    const avgDuration = totalOps > 0 
      ? (last24h.reduce((sum, op) => sum + op.duration_ms, 0) / totalOps).toFixed(0)
      : '0';

    return { totalOps, successOps, failedOps, retriedOps, successRate, avgDuration };
  };

  const metrics = calculateMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOps}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.successOps} successful, {metrics.failedOps} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.retriedOps} operations retried
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgDuration}ms</div>
            <p className="text-xs text-muted-foreground">
              Average operation time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Operations</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{failedOps.length}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operations Lists */}
      <Tabs defaultValue="failed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="failed">Failed Operations ({failedOps.length})</TabsTrigger>
          <TabsTrigger value="recent">Recent Operations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="failed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Failed Service Operations</CardTitle>
              <CardDescription>
                Operations that encountered errors and need investigation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {failedOps.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No failed operations in the last 7 days!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {failedOps.map((op) => (
                      <Card key={op.id} className="border-destructive/20">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{op.operation_type.toUpperCase()}</Badge>
                                {getStatusBadge(op.status)}
                                {op.retry_count > 0 && (
                                  <Badge variant="secondary">{op.retry_count} retries</Badge>
                                )}
                              </div>
                              <h4 className="font-semibold">{op.service_name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Booking: {op.booking_id.slice(0, 8)}... • 
                                {formatDistanceToNow(new Date(op.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                              {op.duration_ms}ms
                            </div>
                          </div>
                          
                          <div className="mt-3 p-3 bg-destructive/10 rounded-md">
                            <p className="text-sm font-medium text-destructive mb-1">
                              Error: {op.error_code || 'UNKNOWN'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {op.error_message}
                            </p>
                            {op.error_details && (
                              <details className="mt-2 text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  View technical details
                                </summary>
                                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                                  {JSON.stringify(op.error_details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Operations</CardTitle>
              <CardDescription>
                Last 100 service operations across all statuses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {recentOps.map((op) => (
                    <div key={op.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(op.status)}
                          <Badge variant="outline" className="text-xs">{op.operation_type}</Badge>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{op.service_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(op.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{op.duration_ms}ms</p>
                        {op.retry_count > 0 && (
                          <p className="text-xs text-muted-foreground">{op.retry_count} retries</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operation Analytics</CardTitle>
              <CardDescription>
                Hourly aggregated metrics for the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {analytics.map((stat, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium">{stat.operation_type.toUpperCase()}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(stat.time_bucket).toLocaleString()}
                            </p>
                          </div>
                          {getStatusBadge(stat.status)}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Operations</p>
                            <p className="font-bold text-lg">{stat.operation_count}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Avg Duration</p>
                            <p className="font-bold text-lg">{Math.round(stat.avg_duration_ms)}ms</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Workers</p>
                            <p className="font-bold text-lg">{stat.unique_workers}</p>
                          </div>
                        </div>
                        {stat.operations_with_retries > 0 && (
                          <p className="text-xs text-yellow-600 mt-2">
                            {stat.operations_with_retries} operations required retries
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
