import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Loader2,
  Database
} from 'lucide-react';
import { BulkZipcodeAssignment } from './BulkZipcodeAssignment';
import { 
  LazyEnhancedWorkerServiceAreasMapImproved, 
  LazyAdminServiceAreaMap,
  LazyAdminZipCodeManager,
  
  withLazyLoading 
} from './LazyAdminComponents';
import ServiceAreaMap from '@/components/worker/service-area/ServiceAreaMap';
import { useAdminServiceAreas } from '@/hooks/useAdminServiceAreas';
import { useRealtimeServiceAreas } from '@/hooks/useRealtimeServiceAreas';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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
  const [viewMode, setViewMode] = useState<'overview' | 'manage' | 'drawing' | 'data'>('overview');
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [activeTab, setActiveTab] = useState<'coverage' | 'map' | 'zips' | 'audit'>('coverage');
  const [initialLoaded, setInitialLoaded] = useState(false);

  // ZCTA loading states
  const [isLoadingZcta, setIsLoadingZcta] = useState(false);
  const [zctaProgress, setZctaProgress] = useState({ current: 0, total: 0 });

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

  // Load ZCTA Data Function
  const loadZctaData = async () => {
    if (isLoadingZcta) return;
    
    setIsLoadingZcta(true);
    setZctaProgress({ current: 0, total: 0 });
    
    try {
      toast({
        title: "Loading ZCTA Data",
        description: "Fetching ZIP code boundary data...",
      });

      // Fetch the GeoJSON file
      const response = await fetch('/zcta2020_web.geojson');
      if (!response.ok) {
        throw new Error(`Failed to fetch GeoJSON: ${response.statusText}`);
      }

      const geojsonData = await response.json();
      const features = geojsonData.features || [];
      
      if (features.length === 0) {
        throw new Error('No features found in GeoJSON file');
      }

      // Process in batches of 50
      const batchSize = 50;
      const totalBatches = Math.ceil(features.length / batchSize);
      setZctaProgress({ current: 0, total: totalBatches });

      toast({
        title: "Processing ZCTA Data",
        description: `Processing ${features.length} ZIP code boundaries in ${totalBatches} batches...`,
      });

      let successfulBatches = 0;
      let failedBatches = 0;

      for (let i = 0; i < features.length; i += batchSize) {
        const batch = features.slice(i, i + batchSize);
        const batchIndex = Math.floor(i / batchSize) + 1;
        
        try {
          // Transform features to match database schema
          const transformedBatch = batch.map((feature: any) => ({
            zcta5ce: feature.properties?.ZCTA5CE20 || feature.properties?.ZCTA5CE || '',
            geom: feature.geometry,
            land_area: feature.properties?.ALAND20 || feature.properties?.ALAND || 0,
            water_area: feature.properties?.AWATER20 || feature.properties?.AWATER || 0
          })).filter(item => item.zcta5ce); // Filter out items without ZIP codes

          if (transformedBatch.length === 0) {
            console.warn(`Batch ${batchIndex} has no valid ZIP codes, skipping`);
            continue;
          }

          // Call the database function
          const { error } = await supabase.rpc('load_zcta_polygons_batch', {
            polygon_data: transformedBatch
          });

          if (error) {
            console.error(`Batch ${batchIndex} failed:`, error);
            failedBatches++;
            
            // Show warning for individual batch failure but continue
            toast({
              title: "Batch Warning",
              description: `Batch ${batchIndex}/${totalBatches} failed: ${error.message}`,
              variant: "destructive",
            });
          } else {
            successfulBatches++;
          }

        } catch (batchError) {
          console.error(`Batch ${batchIndex} processing error:`, batchError);
          failedBatches++;
        }

        // Update progress
        setZctaProgress({ current: batchIndex, total: totalBatches });

        // Show progress every 20 batches or on completion
        if (batchIndex % 20 === 0 || batchIndex === totalBatches) {
          toast({
            title: "Loading Progress",
            description: `Processed ${batchIndex}/${totalBatches} batches (${successfulBatches} successful, ${failedBatches} failed)`,
          });
        }

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Final result
      const totalProcessed = successfulBatches + failedBatches;
      toast({
        title: "ZCTA Data Loading Complete",
        description: `Finished: ${successfulBatches}/${totalProcessed} batches successful. ${successfulBatches * batchSize} ZIP boundaries loaded.`,
        variant: successfulBatches > 0 ? "default" : "destructive",
      });

      // Refresh spatial health check if any batches were successful
      if (successfulBatches > 0) {
        setTimeout(() => {
          supabase.rpc('check_spatial_health').then(({ data }) => {
            if (data) {
              const healthData = data as any;
              toast({
                title: "Updated Spatial Health",
                description: `ZCTA polygons: ${healthData.zcta_polygon_count || 0}`,
              });
            }
          });
        }, 2000);
      }

    } catch (error) {
      console.error('ZCTA loading failed:', error);
      toast({
        title: "ZCTA Loading Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsLoadingZcta(false);
      setZctaProgress({ current: 0, total: 0 });
    }
  };

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
    if (activeTab === 'audit' && initialLoaded) {
      fetchAuditLogs();
    }
  }, [activeTab, initialLoaded, fetchAuditLogs]);

  // Optimized debug logging - only log when data changes significantly
  useEffect(() => {
    if (workers.length > 0) {
      console.log('AdminServiceAreasUnified: Workers loaded:', workers.length, 'workers');
    }
  }, [workers.length]);

  // Auto-select first worker when in manage mode - optimized
  useEffect(() => {
    if (viewMode === 'manage' && workers.length > 0 && !selectedWorkerId && initialLoaded) {
      const firstActiveWorker = workers.find(w => w.is_active) || workers[0];
      if (firstActiveWorker) {
        setSelectedWorkerId(firstActiveWorker.id);
        // Defer audit log loading
        setTimeout(() => fetchAuditLogs(firstActiveWorker.id), 100);
      }
    }
  }, [workers, selectedWorkerId, viewMode, fetchAuditLogs, initialLoaded]);

  // Optimized real-time updates - only enable after initial load
  useRealtimeServiceAreas({
    onUpdate: () => {
      if (initialLoaded) {
        refreshData(false); // Use cache for real-time updates
        if (selectedWorkerId && activeTab === 'audit') {
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
    throttleMs: 500 // Increased throttle to reduce load
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
    if (activeTab === 'audit') {
      fetchAuditLogs(selectedWorkerId || undefined);
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
    // Use total_zipcodes if available from the RPC call, otherwise calculate from service_zipcodes
    const totalZipCodes = worker.total_zipcodes || new Set((worker.service_zipcodes || []).filter(zip => {
      const area = (worker.service_areas || []).find(a => a.id === zip.service_area_id);
      return area && area.is_active;
    }).map(zip => zip.zipcode)).size;
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
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MapPin className="h-8 w-8 text-blue-400" />
            Service Areas
          </h1>
          <p className="text-slate-300">
            {viewMode === 'overview' ? 'View and manage worker service coverage across all areas' : 
             viewMode === 'manage' ? 'Manage individual worker service areas and zip code assignments' :
             viewMode === 'drawing' ? 'Draw and edit service area polygons for workers' :
             'Manage comprehensive ZIP code and ZCTA polygon data'}
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
              Overview
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
              Manage
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
              Draw
            </Button>
            <Button
              variant={viewMode === 'data' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('data')}
              className={`text-sm font-medium px-3 py-2 ${
                viewMode === 'data' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Database className="h-4 w-4 mr-1" />
              Data
            </Button>
          </div>

          {/* Back Button for non-overview modes */}
          {viewMode !== 'overview' && (
            <Button onClick={() => setViewMode('overview')} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Overview
            </Button>
          )}
          <BulkZipcodeAssignment workers={filteredWorkers} onAssignZipcodes={addZipcodesToExistingArea} />
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={loadZctaData}
            disabled={isLoadingZcta}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoadingZcta ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {zctaProgress.total > 0 ? `${zctaProgress.current}/${zctaProgress.total}` : 'Loading...'}
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                Load ZCTA Data
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              supabase.rpc('check_spatial_health').then(({ data, error }) => {
                if (error) {
                  toast({
                    title: "Health Check Failed",
                    description: error.message,
                    variant: "destructive",
                  });
                } else {
                  const healthData = data as any;
                  toast({
                    title: "Spatial Health Check",
                    description: `Status: ${healthData?.overall_health || 'unknown'} | ZIP polygons: ${healthData?.zcta_polygon_count || 0} | ZIP codes: ${healthData?.zip_code_count || 0} | Sample test: ${healthData?.sample_test_zipcode_count || 0} ZIPs`,
                  });
                }
              });
            }}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            Health Check
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
                  <div className="space-y-2">
                    {filteredWorkers.map(worker => {
                      const stats = getWorkerStats(worker);
                      const isSelected = selectedWorkerId === worker.id;
                      return (
                        <div 
                          key={worker.id} 
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/20'
                          }`}
                          onClick={() => handleWorkerSelect(worker.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm">{worker.name}</h4>
                                <Badge variant={worker.is_active ? 'default' : 'secondary'} className="text-xs">
                                  {worker.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>{stats.activeAreas} areas</span>
                                <span>{stats.totalZipCodes} ZIPs</span>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWorkerId(worker.id);
                                setViewMode('manage');
                              }}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
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
                  Coverage Overview
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
                    <LazyEnhancedWorkerServiceAreasMapImproved 
                      workers={mappedWorkers} 
                      selectedWorkerId={selectedWorkerId} 
                      showInactiveAreas={showInactiveAreas}
                      showZipBoundaries={true}
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
                  Manage Areas
                </Button>
                <Button 
                  variant={viewMode === 'drawing' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setViewMode('drawing')}
                  disabled={!selectedWorkerId}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Draw New Area
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* SINGLE MAP PANEL - Only one map renders based on mode */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  {viewMode === 'drawing' ? 'Area Drawing Tool' : 'Service Area Manager'}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[600px] p-0">
                {selectedWorkerId ? (
                  viewMode === 'drawing' ? (
                    /* DRAWING MODE - Map for drawing new areas */
                    <LazyAdminServiceAreaMap
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
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Select a worker to {viewMode === 'drawing' ? 'draw service areas' : 'manage their service areas'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* DATA MANAGEMENT MODE - REMOVED */}
      {viewMode === 'data' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription>
                ZIP code data management features have been removed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">This functionality is no longer available.</p>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
};