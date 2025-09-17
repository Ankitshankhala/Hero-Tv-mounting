import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, MapPin, Users, Activity } from 'lucide-react';
import ServiceAreaMap from '@/components/worker/service-area/ServiceAreaMap';
import { useAdminServiceAreas } from '@/hooks/useAdminServiceAreas';
import { useRealtimeServiceAreas } from '@/hooks/useRealtimeServiceAreas';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDistanceToNow } from 'date-fns';
import { apiCache } from '@/utils/optimizedApi';
import { useSpatialHealthCheck } from '@/hooks/useSpatialHealthCheck';
import { AreaNameEditor } from '@/components/shared/AreaNameEditor';
export const AdminServiceAreaManager = () => {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const {
    workers,
    auditLogs,
    loading,
    fetchWorkersWithServiceAreas,
    fetchAuditLogs,
    createServiceAreaForWorker,
    updateServiceAreaName
  } = useAdminServiceAreas();
  
  const { runHealthCheck, isLoading: healthCheckLoading, healthData } = useSpatialHealthCheck();
  const selectedWorker = workers.find(w => w.id === selectedWorkerId);
  useEffect(() => {
    fetchWorkersWithServiceAreas();
    fetchAuditLogs();
  }, [fetchWorkersWithServiceAreas, fetchAuditLogs]);

  // Auto-select first worker when workers are loaded
  useEffect(() => {
    if (workers.length > 0 && !selectedWorkerId) {
      const firstActiveWorker = workers.find(w => w.is_active) || workers[0];
      if (firstActiveWorker) {
        setSelectedWorkerId(firstActiveWorker.id);
        fetchAuditLogs(firstActiveWorker.id);
      }
    }
  }, [workers, selectedWorkerId, fetchAuditLogs]);

  // Set up real-time updates scoped to selected worker to avoid global refresh
  useRealtimeServiceAreas({
    onUpdate: () => {
      fetchWorkersWithServiceAreas(true);
      fetchAuditLogs(selectedWorkerId || undefined);
    },
    filterWorkerId: selectedWorkerId || undefined
  });
  // Debounce worker selection to prevent rapid API calls
  const { debouncedCallback: debouncedWorkerSelect } = useDebounce((workerId: string) => {
    setSelectedWorkerId(workerId);
    fetchAuditLogs(workerId);
  }, 250);

  const handleWorkerSelect = (workerId: string) => {
    // Update UI immediately for responsiveness
    setSelectedWorkerId(workerId);
    // Debounce the API call
    debouncedWorkerSelect(workerId);
  };
  const handleRefresh = () => {
    // Clear cache for fresh data
    apiCache.clear();
    fetchWorkersWithServiceAreas(true);
    fetchAuditLogs(selectedWorkerId || undefined);
  };
  return <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Service Area Management</h1>
          <p className="text-muted-foreground">
            Manage worker service areas and zip code assignments
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map">Interactive Map</TabsTrigger>
          <TabsTrigger value="audit">Activity Log</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Worker Selection Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Select Worker
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedWorkerId} onValueChange={handleWorkerSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a worker..." />
                    </SelectTrigger>
                    <SelectContent>
                      {workers.map(worker => <SelectItem key={worker.id} value={worker.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{worker.name || worker.email}</span>
                            <Badge variant={worker.is_active ? "default" : "secondary"}>
                              {worker.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>

                  {selectedWorker && <div className="space-y-2 p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">{selectedWorker.name || selectedWorker.email}</div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Service Areas:</span>
                          <Badge variant="outline">{selectedWorker.service_area_count}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Zip Codes:</span>
                          <Badge variant="outline">{selectedWorker.total_zipcodes}</Badge>
                        </div>
                      </div>
                    </div>}
                </CardContent>
              </Card>

              {/* Service Areas List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Service Areas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {selectedWorker?.service_areas?.map(area => (
                        <div key={area.id} className="text-xs p-2 bg-muted rounded">
                           <AreaNameEditor
                             area={area as any}
                              onNameUpdate={async (areaId: string, newName: string) => {
                                const success = await updateServiceAreaName(areaId, newName);
                                if (success) {
                                  // Refresh complete data after successful name update
                                  fetchWorkersWithServiceAreas(true);
                                  fetchAuditLogs(selectedWorkerId);
                                }
                                return success;
                              }}
                            trigger="inline"
                          />
                          <div className="text-muted-foreground mt-1">
                            Status: <Badge variant={area.is_active ? "default" : "secondary"} className="text-xs">
                              {area.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      )) || (
                        <div className="text-muted-foreground text-center py-4">
                          No service areas found
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-32">
                    <div className="space-y-2">
                      {auditLogs.slice(0, 3).map(log => <div key={log.id} className="text-xs p-2 bg-muted rounded">
                          <div className="font-medium">{log.change_summary}</div>
                          <div className="text-muted-foreground">
                            {formatDistanceToNow(new Date(log.changed_at), {
                          addSuffix: true
                        })}
                          </div>
                        </div>)}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Map Panel */}
            <div className="lg:col-span-3">
              <Card className="h-[600px]">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    Service Area Map
                    {selectedWorker && <span className="ml-2 text-sm font-normal text-muted-foreground">
                        - {selectedWorker.name || selectedWorker.email}
                      </span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-full p-0">
                  {selectedWorkerId ? <ServiceAreaMap 
                    workerId={selectedWorkerId} 
                    onServiceAreaCreated={() => {
                      // Clear cache and refresh complete data
                      apiCache.clear();
                      fetchWorkersWithServiceAreas(true);
                      fetchAuditLogs(selectedWorkerId);
                    }}
                    adminMode={true} 
                    isActive={true} 
                    key={selectedWorkerId} // Force re-mount for new worker
                  /> : <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a worker to view and edit their service areas</p>
                      </div>
                    </div>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <p className="text-sm text-muted-foreground">
                Track all service area changes and assignments
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.length > 0 ? auditLogs.map(log => <div key={log.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                      <Badge variant={log.operation === 'INSERT' ? 'default' : log.operation === 'UPDATE' ? 'secondary' : 'destructive'}>
                        {log.operation}
                      </Badge>
                      <div className="flex-1">
                        <div className="font-medium">{log.change_summary}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(log.changed_at), {
                      addSuffix: true
                    })}
                        </div>
                      </div>
                    </div>) : <div className="text-center text-muted-foreground py-8">
                    No activity logs found
                  </div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Spatial System Health Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Button
                  onClick={runHealthCheck}
                  disabled={healthCheckLoading}
                  variant="outline"
                >
                  <Activity className={`h-4 w-4 mr-2 ${healthCheckLoading ? 'animate-spin' : ''}`} />
                  {healthCheckLoading ? 'Running Check...' : 'Run Health Check'}
                </Button>
                
                {healthData && (
                  <Badge 
                    variant={
                      healthData.health_data.overall_health === 'healthy' 
                        ? 'default' 
                        : healthData.health_data.overall_health === 'degraded_no_polygons'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {healthData.health_data.overall_health.toUpperCase()}
                  </Badge>
                )}
              </div>

              {healthData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium">PostGIS Version</div>
                    <div className="text-lg">{healthData.health_data.postgis_version}</div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium">ZCTA Polygons</div>
                    <div className="text-lg">{healthData.health_data.zcta_polygons_count.toLocaleString()}</div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium">US ZIP Codes</div>
                    <div className="text-lg">{healthData.health_data.us_zip_codes_count.toLocaleString()}</div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium">Sample Test</div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={healthData.health_data.sample_test_success ? 'default' : 'destructive'}>
                        {healthData.health_data.sample_test_success ? 'PASS' : 'FAIL'}
                      </Badge>
                      {healthData.health_data.sample_test_zipcode_count > 0 && (
                        <span className="text-sm">{healthData.health_data.sample_test_zipcode_count} ZIPs</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium">Last Check</div>
                    <div className="text-sm">{new Date(healthData.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              )}

              {healthData?.recommendations && (
                <div className="space-y-2">
                  <div className="font-medium">Recommendations:</div>
                  <div className="space-y-1">
                    {healthData.recommendations.map((rec, index) => (
                      <div key={index} className="text-sm p-2 bg-muted rounded">
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!healthData && (
                <div className="text-center text-muted-foreground py-8">
                  Run a health check to see spatial system status and diagnostics
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>;
};