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
import { EnhancedWorkerServiceAreasMap } from './EnhancedWorkerServiceAreasMap';
import AdminServiceAreaMap from './AdminServiceAreaMap';
import AdminZipCodeManager from './AdminZipCodeManager';
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
  const [viewMode, setViewMode] = useState<'overview' | 'manage' | 'drawing'>('overview');
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [activeTab, setActiveTab] = useState<'coverage' | 'map' | 'zips' | 'audit'>('coverage');
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
  const {
    toast
  } = useToast();
  useEffect(() => {
    console.log('AdminServiceAreasUnified: Fetching workers with service areas...');
    fetchWorkersWithServiceAreas(true); // Force fresh data with service areas
    fetchAuditLogs();
  }, [fetchWorkersWithServiceAreas, fetchAuditLogs]);

  // Debug workers data
  useEffect(() => {
    console.log('AdminServiceAreasUnified: Workers data updated:', workers.length, 'workers');
    workers.forEach(worker => {
      console.log(`Worker: ${worker.name}, Service Areas: ${worker.service_areas?.length || 0}, ZIP Codes: ${worker.service_zipcodes?.length || 0}`);
      if (worker.service_areas && worker.service_areas.length > 0) {
        worker.service_areas.forEach(area => {
          console.log(`  Area: ${area.area_name}, Has Polygon: ${!!area.polygon_coordinates}, Active: ${area.is_active}`);
        });
      }
    });
  }, [workers]);

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

  // Set up enhanced real-time updates
  useRealtimeServiceAreas({
    onUpdate: () => {
      refreshData(true); // This calls fetchWorkersWithServiceAreas internally
      fetchAuditLogs(selectedWorkerId || undefined);
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
    throttleMs: 200
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
    refreshData(true); // This calls fetchWorkersWithServiceAreas internally
    fetchAuditLogs(selectedWorkerId || undefined);
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
  return <div className="p-6 space-y-6">
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
             'Draw and edit service area polygons for workers'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle - Enhanced Visibility */}
          <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-1 border border-slate-600">
            <Button
              variant={viewMode === 'overview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('overview')}
              className={`text-sm font-medium px-4 py-2 ${
                viewMode === 'overview' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Eye className="h-4 w-4 mr-2" />
              Overview
            </Button>
            <Button
              variant={viewMode === 'manage' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('manage')}
              className={`text-sm font-medium px-4 py-2 ${
                viewMode === 'manage' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage
            </Button>
            <Button
              variant={viewMode === 'drawing' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('drawing')}
              disabled={!selectedWorkerId}
              className={`text-sm font-medium px-4 py-2 ${
                viewMode === 'drawing' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              } ${!selectedWorkerId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Map className="h-4 w-4 mr-2" />
              Draw
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
                
                <CardContent className="space-y-4">
                  {viewMode === 'overview' ? <>
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
                    </> : <>
                      {/* Worker Selection for Management */}
                      <Select value={selectedWorkerId} onValueChange={handleWorkerSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a worker..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(workers || []).map(worker => <SelectItem key={worker.id} value={worker.id}>
                              <div className="flex items-center gap-2">
                                <span>{worker.name}</span>
                                {!worker.is_active && <Badge variant="secondary" className="text-xs">
                                    Inactive
                                  </Badge>}
                              </div>
                            </SelectItem>)}
                        </SelectContent>
                      </Select>

                      {/* Selected Worker Details */}
                      {selectedWorker && <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
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
                        </div>}

                      {/* Mode Switch */}
                      <Separator />
                      <Button onClick={() => setViewMode('overview')} variant="ghost" size="sm" className="w-full">
                        <MapPin className="h-4 w-4 mr-2" />
                        Switch to Coverage View
                      </Button>
                    </>}
                </CardContent>
              </Card>

              {/* Worker List in Overview Mode */}
              {viewMode === 'overview' && <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Workers ({filteredWorkers.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {filteredWorkers.map(worker => {
                      const stats = getWorkerStats(worker);
                      return <div key={worker.id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedWorkerId === worker.id ? 'bg-accent border-accent-foreground' : 'hover:bg-muted/50'}`} onClick={() => handleWorkerSelect(worker.id)}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{worker.name}</p>
                                  <p className="text-xs text-muted-foreground">{worker.email}</p>
                                </div>
                                <Button size="sm" variant="ghost" onClick={e => {
                            e.stopPropagation();
                            setSelectedWorkerId(worker.id);
                            setViewMode('manage');
                          }} className="h-6 w-6 p-0">
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
                            </div>;
                    })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>}
            </div>

            {/* Main Map Area */}
            <div className="lg:col-span-3">
              <Card className="h-[600px]">
                <CardContent className="p-0 h-full">
                  {viewMode === 'overview' ? (() => {
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
                    console.log('Passing workers to map:', mappedWorkers.length, 'workers');
                    console.log('Workers data:', mappedWorkers);
                    return (
                      <EnhancedWorkerServiceAreasMap 
                        workers={mappedWorkers} 
                        selectedWorkerId={null} 
                        showInactiveAreas={showInactiveAreas}
                        showZipBoundaries={true}
                      />
                    );
                  })() : selectedWorker ? <ServiceAreaMap workerId={selectedWorkerId} isActive={true} adminMode={true} onServiceAreaUpdate={refreshData} /> : <div className="flex items-center justify-center h-full text-muted-foreground">
                      Select a worker to manage their service areas
                    </div>}
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
                {filteredWorkers.map(worker => {
                const stats = getWorkerStats(worker);
                return <div key={worker.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{worker.name}</h3>
                          <Badge variant={worker.is_active ? 'default' : 'secondary'}>
                            {worker.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{worker.email}</p>
                        {worker.phone && <p className="text-sm text-muted-foreground">{worker.phone}</p>}
                        <div className="flex gap-4 text-sm">
                          <span>Areas: {stats.activeAreas}/{(worker.service_areas || []).length}</span>
                          <span>ZIP Codes: {stats.totalZipCodes}</span>
                          {stats.areasNeedingBackfill > 0 && <span className="text-amber-400">
                              {stats.areasNeedingBackfill} areas need ZIP codes
                            </span>}
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {(worker.service_zipcodes || []).slice(0, 5).map((zip, index) => <Badge key={index} variant="outline" className="text-xs">
                                {zip.zipcode}
                              </Badge>)}
                            {(worker.service_zipcodes || []).length > 5 && <Badge variant="outline" className="text-xs">
                                +{(worker.service_zipcodes || []).length - 5} more
                              </Badge>}
                          </div>
                          {(worker.service_areas || []).length > 0 && <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Service Areas:</p>
                              {(worker.service_areas || []).map(area => {
                          const areaZipCodes = (worker.service_zipcodes || []).filter(zip => zip.service_area_id === area.id);
                          const hasPolygon = safeParsePolygonCoords(area.polygon_coordinates);
                          const needsBackfill = hasPolygon && areaZipCodes.length === 0;
                          return <div key={area.id} className="flex items-center gap-2 group">
                                  {editingArea === area.id ? <div className="flex items-center gap-2">
                                      <Input value={editingName} onChange={e => setEditingName(e.target.value)} className="h-6 text-xs" autoFocus onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  saveAreaName(area.id);
                                } else if (e.key === 'Escape') {
                                  cancelEditing();
                                }
                              }} />
                                      <Button size="sm" variant="ghost" onClick={() => saveAreaName(area.id)} className="h-6 w-6 p-0">
                                        <Check className="h-3 w-3 text-green-600" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-6 w-6 p-0">
                                        <XIcon className="h-3 w-3 text-red-600" />
                                      </Button>
                                    </div> : <div className="flex items-center gap-1">
                                       <Badge variant={area.is_active ? "default" : "secondary"} className="text-xs">
                                         {area.area_name}
                                       </Badge>
                                       {needsBackfill && <Badge variant="outline" className="text-xs bg-amber-600/10 border-amber-600/20 text-amber-400">
                                           Missing ZIPs
                                         </Badge>}
                                       {areaZipCodes.length > 0 && <Badge variant="outline" className="text-xs text-green-400">
                                           {areaZipCodes.length} ZIPs
                                         </Badge>}
                                      <Button size="sm" variant="ghost" onClick={() => startEditing(area.id, area.area_name)} className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Edit2 className="h-2 w-2" />
                                      </Button>
                                    </div>}
                                 </div>;
                        })}
                            </div>}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => {
                    setSelectedWorkerId(worker.id);
                    setViewMode('manage');
                  }}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Manage
                      </Button>
                    </div>;
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
                  {(auditLogs || []).length === 0 ? <p className="text-muted-foreground text-center py-8">
                      No activity logs found
                    </p> : (auditLogs || []).map(log => <div key={log.id} className="border-l-2 border-muted pl-4 py-2">
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
                            {formatDistanceToNow(new Date(log.changed_at), {
                        addSuffix: true
                      })}
                          </span>
                        </div>
                      </div>)}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drawing Mode - Admin Map Drawing Interface */}
      {viewMode === 'drawing' && (
        <div className="space-y-6">
          {!selectedWorkerId ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-6 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-amber-600" />
                <h3 className="text-lg font-semibold text-amber-800 mb-2">Select a Worker</h3>
                <p className="text-amber-700 mb-4">
                  Please select a worker from the overview to start drawing service areas
                </p>
                <Button 
                  onClick={() => setViewMode('overview')}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Overview
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Worker Info Panel */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Selected Worker
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedWorker && (
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold">{selectedWorker.name}</h3>
                          <p className="text-sm text-muted-foreground">{selectedWorker.email}</p>
                          <Badge variant={selectedWorker.is_active ? 'default' : 'secondary'} className="mt-1">
                            {selectedWorker.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <Separator />
                        <div className="space-y-2">
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
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('zips')}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Manage ZIP Codes
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('audit')}
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      View Activity Log
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Main Drawing Interface */}
              <div className="lg:col-span-2">
                {activeTab === 'coverage' && (
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
                )}

                {activeTab === 'zips' && selectedWorker && (
                  <AdminZipCodeManager
                    workerId={selectedWorkerId}
                    workerName={selectedWorker.name}
                    onZipCodeUpdate={() => {
                      refreshData(true);
                      fetchAuditLogs(selectedWorkerId);
                    }}
                  />
                )}

                {activeTab === 'audit' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Activity Log - {selectedWorker?.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96">
                        <div className="space-y-3">
                          {auditLogs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p>No activity logs found</p>
                            </div>
                          ) : (
                            auditLogs.map((log) => (
                              <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{log.change_summary}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(log.changed_at), { addSuffix: true })}
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>;
};