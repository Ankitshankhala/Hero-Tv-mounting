import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  MapPin, 
  Users, 
  Download, 
  Eye, 
  EyeOff, 
  Filter, 
  RefreshCw, 
  Edit3,
  ArrowLeft
} from 'lucide-react';
import { WorkerServiceAreasMap } from './WorkerServiceAreasMap';
import ServiceAreaMap from '@/components/worker/service-area/ServiceAreaMap';
import { useAdminServiceAreas } from '@/hooks/useAdminServiceAreas';
import { useRealtimeServiceAreas } from '@/hooks/useRealtimeServiceAreas';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
import { formatDistanceToNow } from 'date-fns';

interface CoverageWorker {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  total_zipcodes?: number;
  service_areas: Array<{
    id: string;
    area_name: string;
    polygon_coordinates: any;
    is_active: boolean;
    created_at: string;
  }>;
  service_zipcodes: Array<{
    zipcode: string;
    service_area_id: string;
  }>;
}

export const AdminServiceAreasUnified = () => {
  // Coverage Manager states
  const [searchTerm, setSearchTerm] = useState('');
  const [zipCodeFilter, setZipCodeFilter] = useState('');
  const [showInactiveWorkers, setShowInactiveWorkers] = useState(false);
  const [showInactiveAreas, setShowInactiveAreas] = useState(false);
  
  // Service Area Manager states
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'overview' | 'manage'>('overview');
  
  const {
    workers: adminWorkers,
    auditLogs,
    loading,
    fetchWorkersWithServiceAreas,
    fetchWorkers,
    fetchAuditLogs,
    refreshData
  } = useAdminServiceAreas();

  const workers = adminWorkers as CoverageWorker[];
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkersWithServiceAreas(true); // Force fresh data
    fetchWorkers();
    fetchAuditLogs();
  }, [fetchWorkersWithServiceAreas, fetchWorkers, fetchAuditLogs]);

  // Auto-select first worker when in manage mode
  useEffect(() => {
    if (viewMode === 'manage' && workers.length > 0 && !selectedWorkerId) {
      const firstActiveWorker = workers.find(w => w.is_active) || workers[0];
      if (firstActiveWorker) {
        setSelectedWorkerId(firstActiveWorker.id);
        fetchAuditLogs(firstActiveWorker.id);
      }
    }
  }, [workers, selectedWorkerId, viewMode, fetchAuditLogs]);

  // Set up real-time updates
  useRealtimeServiceAreas(() => {
    refreshData(true);
    fetchWorkers();
    fetchAuditLogs(selectedWorkerId || undefined);
  });

  // Debounce worker selection
  const { debouncedCallback: debouncedWorkerSelect } = useDebounce((workerId: string) => {
    setSelectedWorkerId(workerId);
    fetchAuditLogs(workerId);
  }, 250);

  const filteredWorkers = (workers || []).filter(worker => {
    const matchesSearch = worker.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         worker.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         worker.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZipCode = !zipCodeFilter || 
                          (worker.service_zipcodes || []).some(zip => zip.zipcode.includes(zipCodeFilter));
    const matchesActiveFilter = showInactiveWorkers || worker.is_active;
    return matchesSearch && matchesZipCode && matchesActiveFilter;
  });

  const selectedWorker = selectedWorkerId ? (workers || []).find(w => w.id === selectedWorkerId) : null;

  const handleWorkerSelect = (workerId: string) => {
    if (viewMode === 'overview') {
      setSelectedWorkerId(workerId === selectedWorkerId ? null : workerId);
    } else {
      setSelectedWorkerId(workerId);
      debouncedWorkerSelect(workerId);
    }
  };

  const handleRefresh = () => {
    refreshData(true);
    fetchWorkers();
    fetchAuditLogs(selectedWorkerId || undefined);
  };

  const handleExportCSV = () => {
    const exportData = filteredWorkers.flatMap(worker =>
      (worker.service_areas || [])
        .filter(area => showInactiveAreas || area.is_active)
        .map(area => ({
          'Worker Name': worker.name || '',
          'Worker Email': worker.email || '',
          'Worker ID': worker.id || '',
          'Area Name': area.area_name || '',
          'Area Status': area.is_active ? 'Active' : 'Inactive',
          'Zip Codes': (worker.service_zipcodes || [])
            .filter(zip => zip.service_area_id === area.id)
            .map(zip => zip.zipcode)
            .join(', '),
          'Created Date': new Date(area.created_at).toLocaleDateString(),
          'Worker Active': worker.is_active ? 'Yes' : 'No'
        }))
    );
    exportToCSV(exportData, 'worker-service-areas');
    toast({
      title: "Export Complete",
      description: "Service area data exported to CSV"
    });
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF(filteredWorkers, 'worker-service-areas');
      toast({
        title: "Export Complete",
        description: "Service area data exported to PDF"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF export",
        variant: "destructive"
      });
    }
  };

  const getWorkerStats = (worker: CoverageWorker) => {
    // Use total_zipcodes if available from the RPC call, otherwise calculate from service_zipcodes
    const totalZipCodes = worker.total_zipcodes || new Set(
      (worker.service_zipcodes || [])
        .filter(zip => {
          const area = (worker.service_areas || []).find(a => a.id === zip.service_area_id);
          return area && area.is_active;
        })
        .map(zip => zip.zipcode)
    ).size;

    const activeAreas = (worker.service_areas || []).filter(area => area.is_active).length;
    
    return { activeAreas, totalZipCodes };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">
            Service Areas {viewMode === 'manage' ? 'Management' : 'Coverage'}
          </h1>
          <p className="text-muted-foreground">
            {viewMode === 'overview' 
              ? 'View and manage worker service coverage across all areas'
              : 'Manage individual worker service areas and zip code assignments'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'manage' && (
            <Button
              onClick={() => setViewMode('overview')}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Overview
            </Button>
          )}
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map">
            {viewMode === 'overview' ? 'Coverage Map' : 'Area Editor'}
          </TabsTrigger>
          <TabsTrigger value="list">Workers List</TabsTrigger>
          <TabsTrigger value="audit">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Panel - Worker Selection & Filters */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    {viewMode === 'overview' ? 'Coverage Filters' : 'Select Worker'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {viewMode === 'overview' ? (
                    <>
                      {/* Search */}
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input
                          placeholder="Search workers..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>

                      {/* ZIP Code Filter */}
                      <Input
                        placeholder="Filter by ZIP code..."
                        value={zipCodeFilter}
                        onChange={(e) => setZipCodeFilter(e.target.value)}
                      />

                      {/* Toggle Filters */}
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowInactiveWorkers(!showInactiveWorkers)}
                          className="w-full justify-start"
                        >
                          {showInactiveWorkers ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                          {showInactiveWorkers ? 'Hide' : 'Show'} Inactive Workers
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowInactiveAreas(!showInactiveAreas)}
                          className="w-full justify-start"
                        >
                          {showInactiveAreas ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                          {showInactiveAreas ? 'Hide' : 'Show'} Inactive Areas
                        </Button>
                      </div>

                      {/* Export Actions */}
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportCSV}
                          className="w-full"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportPDF}
                          className="w-full"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export PDF
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Worker Selection for Management */}
                      <Select value={selectedWorkerId} onValueChange={handleWorkerSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a worker..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(workers || []).map((worker) => (
                            <SelectItem key={worker.id} value={worker.id}>
                              <div className="flex items-center gap-2">
                                <span>{worker.name}</span>
                                {!worker.is_active && (
                                  <Badge variant="secondary" className="text-xs">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Selected Worker Details */}
                      {selectedWorker && (
                        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                          <h4 className="font-medium">{selectedWorker.name}</h4>
                          <p className="text-sm text-muted-foreground">{selectedWorker.email}</p>
                          {selectedWorker.phone && (
                            <p className="text-sm text-muted-foreground">{selectedWorker.phone}</p>
                          )}
                          <div className="flex gap-2">
                            <Badge variant={selectedWorker.is_active ? 'default' : 'secondary'}>
                              {selectedWorker.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline">
                              {(selectedWorker.service_areas || []).length} Areas
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* Mode Switch */}
                      <Separator />
                      <Button
                        onClick={() => setViewMode('overview')}
                        variant="ghost"
                        size="sm"
                        className="w-full"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Switch to Coverage View
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Worker List in Overview Mode */}
              {viewMode === 'overview' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Workers ({filteredWorkers.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {filteredWorkers.map((worker) => {
                          const stats = getWorkerStats(worker);
                          return (
                            <div
                              key={worker.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                selectedWorkerId === worker.id
                                  ? 'bg-accent border-accent-foreground'
                                  : 'hover:bg-muted/50'
                              }`}
                              onClick={() => handleWorkerSelect(worker.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{worker.name}</p>
                                  <p className="text-xs text-muted-foreground">{worker.email}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedWorkerId(worker.id);
                                    setViewMode('manage');
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex gap-1 mt-2">
                                <Badge variant={worker.is_active ? 'default' : 'secondary'} className="text-xs">
                                  {worker.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {stats.activeAreas} Areas
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {stats.totalZipCodes} ZIPs
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Main Map Area */}
            <div className="lg:col-span-3">
              <Card className="h-[600px]">
                <CardContent className="p-0 h-full">
                  {viewMode === 'overview' ? (
                    <WorkerServiceAreasMap
                      workers={filteredWorkers}
                      selectedWorkerId={selectedWorkerId}
                      showInactiveAreas={showInactiveAreas}
                    />
                  ) : selectedWorker ? (
                    <ServiceAreaMap 
                      workerId={selectedWorkerId} 
                      isActive={true}
                      adminMode={true}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Select a worker to manage their service areas
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workers Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredWorkers.map((worker) => {
                  const stats = getWorkerStats(worker);
                  return (
                    <div key={worker.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{worker.name}</h3>
                          <Badge variant={worker.is_active ? 'default' : 'secondary'}>
                            {worker.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{worker.email}</p>
                        {worker.phone && (
                          <p className="text-sm text-muted-foreground">{worker.phone}</p>
                        )}
                        <div className="flex gap-4 text-sm">
                          <span>Areas: {stats.activeAreas}/{(worker.service_areas || []).length}</span>
                          <span>ZIP Codes: {stats.totalZipCodes}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(worker.service_zipcodes || []).slice(0, 5).map((zip, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {zip.zipcode}
                            </Badge>
                          ))}
                          {(worker.service_zipcodes || []).length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{(worker.service_zipcodes || []).length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedWorkerId(worker.id);
                          setViewMode('manage');
                        }}
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Manage
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {(auditLogs || []).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No activity logs found
                    </p>
                  ) : (
                    (auditLogs || []).map((log) => (
                      <div key={log.id} className="border-l-2 border-muted pl-4 py-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {log.operation.replace(/_/g, ' ').toUpperCase()}
                              {log.area_name && ` - ${log.area_name}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {log.change_summary || 'Service area modified'}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.changed_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};