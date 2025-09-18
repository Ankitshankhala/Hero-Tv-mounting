import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleWorkerCard } from './SimpleWorkerCard';
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
  ArrowLeft, 
  Edit2, 
  Check, 
  X as XIcon, 
  Layers,
  Map,
  Settings,
  Activity,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { BulkZipcodeAssignment } from './BulkZipcodeAssignment';
import { OptimizedZipDataManager } from './OptimizedZipDataManager';
import { PerformanceOptimizationSwitch } from './PerformanceOptimizationSwitch';
import { 
  LazyAdminServiceAreaMap,
  withLazyLoading,
  AdminComponentLoader
} from './LazyAdminComponents';
import AdminServiceAreaMap from './AdminServiceAreaMap';
import ServiceAreaMap from '@/components/worker/service-area/ServiceAreaMap';
import { useAdminServiceAreas } from '@/hooks/useAdminServiceAreas';
import { useRealtimeServiceAreas } from '@/hooks/useRealtimeServiceAreas';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { ZctaDataManager } from './ZctaDataManager';
import { WorkerServiceAreasMap } from './WorkerServiceAreasMap';

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
  const [viewMode, setViewMode] = useState<'overview' | 'manage' | 'drawing'>('overview');
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [initialLoaded, setInitialLoaded] = useState(false);

  const {
    workers: adminWorkers,
    auditLogs,
    loading,
    fetchWorkersWithServiceAreas,
    fetchWorkers,
    fetchAuditLogs,
    refreshData,
    addZipcodesToExistingArea,
    updateServiceAreaName
  } = useAdminServiceAreas();
  const workers = adminWorkers as CoverageWorker[];
  const { toast } = useToast();

  // Optimized initial data loading - only fetch when component mounts
  useEffect(() => {
    if (!initialLoaded) {
      console.log('AdminServiceAreasUnified: Initial loading...');
      // Only load basic data initially, defer heavy operations
      fetchWorkersWithServiceAreas(false); // Use cache
      setInitialLoaded(true);
    }
  }, [fetchWorkersWithServiceAreas, initialLoaded]);

  // Defer audit logs loading until needed
  useEffect(() => {
    if (selectedWorkerId && initialLoaded) {
      fetchAuditLogs(selectedWorkerId);
    }
  }, [selectedWorkerId, initialLoaded, fetchAuditLogs]);

  // Optimized debug logging - only log when data changes significantly
  useEffect(() => {
    if (workers.length > 0) {
      console.log('AdminServiceAreasUnified: Workers loaded:', workers.length, 'workers');
    }
  }, [workers.length]);

  // Auto-select first worker when in manage mode and optionally default to drawing mode
  useEffect(() => {
    if (viewMode === 'manage' && workers.length > 0 && !selectedWorkerId && initialLoaded) {
      const firstActiveWorker = workers.find(w => w.is_active) || workers[0];
      if (firstActiveWorker) {
        setSelectedWorkerId(firstActiveWorker.id);
        // Defer audit log loading
        setTimeout(() => fetchAuditLogs(firstActiveWorker.id), 100);
        
        // Optional: Auto-switch to drawing mode to guide users to more accurate flow
        // setTimeout(() => setViewMode('drawing'), 200);
      }
    }
  }, [workers, selectedWorkerId, viewMode, fetchAuditLogs, initialLoaded]);

  // Optimized real-time updates - only enable after initial load
  useRealtimeServiceAreas({
    onUpdate: () => {
      if (initialLoaded) {
        refreshData(false); // Use cache for real-time updates
        if (selectedWorkerId) {
          fetchAuditLogs(selectedWorkerId);
        }
      }
    },
    onError: (error) => {
      console.error('Realtime sync error:', error);
      toast({
        title: "Sync Error",
        description: "Real-time synchronization encountered an issue",
        variant: "destructive",
      });
    },
    enableCacheInvalidation: true,
    throttleMs: 500, // Increased throttle to reduce load
    // Limit realtime change feed to the selected worker to avoid cross-worker updates
    filterWorkerId: selectedWorkerId || undefined
  });

  // Debounce worker selection
  const {
    debouncedCallback: debouncedWorkerSelect
  } = useDebounce((workerId: string) => {
    setSelectedWorkerId(workerId);
    fetchAuditLogs(workerId);
  }, 250);

  const filteredWorkers = (workers || []).filter(worker => {
    const matchesSearch = worker.name?.toLowerCase().includes(searchTerm.toLowerCase()) || worker.email?.toLowerCase().includes(searchTerm.toLowerCase()) || worker.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZipCode = !zipCodeFilter || (worker.service_zipcodes || []).some(zip => zip.zipcode.includes(zipCodeFilter));
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
    refreshData(true); // Force fresh data only on manual refresh
    if (selectedWorkerId) {
      fetchAuditLogs(selectedWorkerId);
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredWorkers.flatMap(worker => (worker.service_areas || []).filter(area => showInactiveAreas || area.is_active).map(area => ({
      'Worker Name': worker.name || '',
      'Worker Email': worker.email || '',
      'Worker ID': worker.id || '',
      'Area Name': area.area_name || '',
      'Area Status': area.is_active ? 'Active' : 'Inactive',
      'Zip Codes': (worker.service_zipcodes || []).filter(zip => zip.service_area_id === area.id).map(zip => zip.zipcode).join(', '),
      'Created Date': new Date(area.created_at).toLocaleDateString(),
      'Worker Active': worker.is_active ? 'Yes' : 'No'
    })));
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

  // Helper function to safely parse polygon coordinates
  const safeParsePolygonCoords = (coordinates: any): boolean => {
    if (!coordinates) return false;
    try {
      let coords;
      if (typeof coordinates === 'string') {
        coords = JSON.parse(coordinates);
      } else if (typeof coordinates === 'object') {
        coords = coordinates;
      } else {
        return false;
      }
      return Array.isArray(coords) && coords.length > 0;
    } catch (error) {
      console.warn('Error parsing polygon coordinates:', error);
      return false;
    }
  };

  const getWorkerStats = (worker: CoverageWorker) => {
    // Prefer server-computed total if available; otherwise count all unique ZIPs for the worker
    // Note: Some ZIPs may have null service_area_id (manual entries). Including them ensures stats aren't undercounted.
    const totalZipCodes = worker.total_zipcodes || new Set((worker.service_zipcodes || []).map(zip => zip.zipcode)).size;
    const activeAreas = (worker.service_areas || []).filter(area => area.is_active).length;

    // Count areas that need backfilling (have polygons but no ZIP codes)
    const areasNeedingBackfill = (worker.service_areas || []).filter(area => {
      const hasPolygon = safeParsePolygonCoords(area.polygon_coordinates);
      const areaZipCodes = (worker.service_zipcodes || []).filter(zip => zip.service_area_id === area.id);
      return hasPolygon && areaZipCodes.length === 0 && area.is_active;
    }).length;

    return {
      activeAreas,
      totalZipCodes,
      areasNeedingBackfill
    };
  };

  const startEditing = (areaId: string, currentName: string) => {
    setEditingArea(areaId);
    setEditingName(currentName);
  };

  const cancelEditing = () => {
    setEditingArea(null);
    setEditingName('');
  };

  const saveAreaName = async (areaId: string) => {
    const success = await updateServiceAreaName(areaId, editingName);
    if (success) {
      setEditingArea(null);
      setEditingName('');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Enhanced ZCTA Database Management */}
      <ZctaDataManager />

      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MapPin className="h-8 w-8 text-blue-400" />
            Service Areas
          </h1>
          <p className="text-slate-300">
            {viewMode === 'overview' ? 'View and manage worker service coverage across all areas' : 
             viewMode === 'manage' ? 'Edit existing service areas and zip code assignments for a worker' :
             viewMode === 'drawing' ? 'Create new service area polygons for a worker' :
             'Service area management'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle - Enhanced Visibility */}
          <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-1 border border-slate-600">
            <Button
              variant={viewMode === 'overview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('overview')}
              className={`text-sm font-medium px-3 py-2 ${
                viewMode === 'overview' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Eye className="h-4 w-4 mr-1" />
              Coverage View
            </Button>
            <Button
              variant={viewMode === 'manage' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('manage')}
              className={`text-sm font-medium px-3 py-2 ${
                viewMode === 'manage' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Settings className="h-4 w-4 mr-1" />
              Edit Areas
            </Button>
            <Button
              variant={viewMode === 'drawing' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('drawing')}
              disabled={!selectedWorkerId}
              className={`text-sm font-medium px-3 py-2 ${
                viewMode === 'drawing' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              } ${!selectedWorkerId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Map className="h-4 w-4 mr-1" />
              Create New
            </Button>
          </div>

          {/* Back Button for non-overview modes */}
          {viewMode !== 'overview' && (
            <Button onClick={() => setViewMode('overview')} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Coverage View
            </Button>
          )}
          <BulkZipcodeAssignment workers={filteredWorkers} onAssignZipcodes={addZipcodesToExistingArea} />
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* SINGLE MAP CONTENT - Based on View Mode */}
      {viewMode === 'overview' ? (
        /* OVERVIEW MODE - Multi-worker coverage map */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 relative">
          {/* Left Panel - Worker Selection & Filters */}
          <div className="lg:col-span-2 space-y-4 relative z-10">
            <Card>
              <CardContent className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input placeholder="Search workers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                </div>

                {/* ZIP Code Filter */}
                <Input placeholder="Filter by ZIP code..." value={zipCodeFilter} onChange={e => setZipCodeFilter(e.target.value)} />

                {/* Toggle Filters */}
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => setShowInactiveWorkers(!showInactiveWorkers)} className="w-full justify-start">
                    {showInactiveWorkers ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {showInactiveWorkers ? 'Hide' : 'Show'} Inactive Workers
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowInactiveAreas(!showInactiveAreas)} className="w-full justify-start">
                    {showInactiveAreas ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {showInactiveAreas ? 'Hide' : 'Show'} Inactive Areas
                  </Button>
                </div>

                {/* Export Actions */}
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={handleExportCSV} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Workers List for Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Workers ({filteredWorkers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-1">
                    {filteredWorkers.map((worker, index) => (
                      <SimpleWorkerCard
                        key={worker.id}
                        worker={worker}
                        isSelected={selectedWorkerId === worker.id}
                        onClick={() => handleWorkerSelect(worker.id)}
                        colorIndex={index}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Map Panel - SINGLE OVERVIEW MAP */}
          <div className="lg:col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Service Coverage Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[600px] p-0">
                {(() => {
                  console.log('Rendering overview map for', workers.length, 'workers');
                  const mappedWorkers = workers.map(worker => ({
                    ...worker,
                    service_areas: (worker.service_areas || []).map(area => ({
                      ...area,
                      zipcode_list: worker.service_zipcodes
                        ?.filter(sz => sz.service_area_id === area.id)
                        ?.map(sz => sz.zipcode) || []
                    })),
                    service_zipcodes: worker.service_zipcodes || []
                  }));
                  return (
                    <WorkerServiceAreasMap 
                      workers={mappedWorkers}
                      selectedWorkerId={selectedWorkerId}
                      showInactiveAreas={showInactiveAreas}
                    />
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* MANAGE/DRAWING MODE - Single worker management */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Worker Selection & Controls */}
          <div className="space-y-4">
            {/* Worker Selection for Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Worker Selection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedWorkerId} onValueChange={handleWorkerSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a worker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(workers || []).map(worker => 
                      <SelectItem key={worker.id} value={worker.id}>
                        <div className="flex items-center gap-2">
                          <span>{worker.name}</span>
                          {!worker.is_active && <Badge variant="secondary" className="text-xs">
                              Inactive
                            </Badge>}
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {/* Selected Worker Details */}
                {selectedWorker && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium">{selectedWorker.name}</h4>
                    <p className="text-sm text-muted-foreground">{selectedWorker.email}</p>
                    {selectedWorker.phone && <p className="text-sm text-muted-foreground">{selectedWorker.phone}</p>}
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
              </CardContent>
            </Card>

            {/* Worker Statistics for Management */}
            {selectedWorker && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Worker Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Service Areas:</span>
                      <span className="font-medium">
                        {(selectedWorker.service_areas || []).filter(a => a.is_active).length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>ZIP Codes:</span>
                      <span className="font-medium">
                        {selectedWorker.total_zipcodes || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Activity Log - Only in manage/drawing mode with selected worker */}
            {selectedWorker && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {(auditLogs || []).length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 text-sm">
                          No recent activity
                        </p>
                      ) : (
                        (auditLogs || []).slice(0, 10).map(log => (
                          <div key={log.id} className="border-l-2 border-muted pl-3 py-2">
                            <div className="space-y-1">
                              <p className="text-xs font-medium">
                                {log.operation.replace(/_/g, ' ').toUpperCase()}
                                {log.area_name && ` - ${log.area_name}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.changed_at), {
                                  addSuffix: true
                                })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Mode Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Mode Selection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant={viewMode === 'manage' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setViewMode('manage')}
                  disabled={!selectedWorkerId}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Existing Areas
                </Button>
                <div className="relative">
                  <Button 
                    variant={viewMode === 'drawing' ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setViewMode('drawing')}
                    disabled={!selectedWorkerId}
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Create New Area
                    {!selectedWorkerId && (
                      <AlertTriangle className="h-3 w-3 ml-auto text-amber-500" />
                    )}
                  </Button>
                  {!selectedWorkerId && (
                    <div className="absolute -bottom-1 left-0 right-0 text-xs text-amber-400 text-center">
                      Select a worker first
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SINGLE MAP PANEL - Only one map renders based on mode */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  {viewMode === 'drawing' ? 'Create New Service Area' : 'Edit Service Areas'}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[600px] p-0">
                {selectedWorkerId ? (
                  viewMode === 'drawing' ? (
                    /* DRAWING MODE - Map for drawing new areas */
                    <Suspense fallback={<AdminComponentLoader />}>
                      <AdminServiceAreaMap
                        workerId={selectedWorkerId}
                        workerName={selectedWorker?.name || 'Unknown Worker'}
                        onServiceAreaUpdate={() => {
                          refreshData(true);
                          fetchAuditLogs(selectedWorkerId);
                        }}
                        onServiceAreaCreated={() => {
                          refreshData(true);
                          fetchAuditLogs(selectedWorkerId);
                        }}
                        isActive={true}
                      />
                    </Suspense>
                  ) : (
                    /* MANAGE MODE - Map for managing existing areas */
                    <ServiceAreaMap 
                      workerId={selectedWorkerId} 
                      isActive={true} 
                      adminMode={true} 
                      onServiceAreaUpdate={refreshData} 
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                    <div className="text-center space-y-2">
                      <AlertTriangle className="h-12 w-12 mx-auto text-amber-500" />
                      <h3 className="text-lg font-medium">Worker Selection Required</h3>
                      <p className="text-sm max-w-md">
                        {viewMode === 'drawing' 
                          ? 'To create new service areas, please select a worker from the list on the left first.' 
                          : 'To edit service areas, please select a worker from the list on the left first.'}
                      </p>
                    </div>
                    {workers.length > 0 && (
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          const firstWorker = workers.find(w => w.is_active) || workers[0];
                          if (firstWorker) {
                            setSelectedWorkerId(firstWorker.id);
                          }
                        }}
                        className="mt-4"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Auto-select First Worker
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}


    </div>
  );
};