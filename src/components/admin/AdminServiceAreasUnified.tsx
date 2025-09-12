import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, MapPin, Users, Download, Eye, EyeOff, Filter, RefreshCw, Edit3, ArrowLeft, Edit2, Check, X as XIcon, Zap } from 'lucide-react';
import { BulkZipcodeAssignment } from './BulkZipcodeAssignment';
import { EnhancedWorkerServiceAreasMap } from './EnhancedWorkerServiceAreasMap';
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
  const [viewMode, setViewMode] = useState<'overview' | 'manage'>('overview');
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isBackfilling, setIsBackfilling] = useState(false);
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
    fetchWorkersWithServiceAreas(true); // Force fresh data with service areas
    fetchAuditLogs();
  }, [fetchWorkersWithServiceAreas, fetchAuditLogs]);

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
    refreshData(true); // This calls fetchWorkersWithServiceAreas internally
    fetchAuditLogs(selectedWorkerId || undefined);
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
  const handleBackfillZipcodes = async () => {
    setIsBackfilling(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('backfill-service-area-zipcodes', {
        body: {}
      });
      if (error) {
        throw error;
      }
      toast({
        title: "Backfill Complete",
        description: `${data.processed} service areas processed, ${data.errors} errors. Found ZIP codes for existing polygon areas.`
      });

      // Refresh data to show updated ZIP codes
      refreshData(true);
    } catch (error) {
      console.error('Backfill error:', error);
      toast({
        title: "Backfill Failed",
        description: error.message || "Failed to backfill ZIP codes",
        variant: "destructive"
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleSanAntonioAssignment = async () => {
    const aydenWorkerId = '7a09f6e8-c068-400f-88c4-321b400a6bb0';
    const sanAntonioZips = [
      '78023', '78108', '78109', '78148', '78150', '78154', '78201', '78202', '78203', '78204', 
      '78205', '78207', '78208', '78209', '78210', '78211', '78212', '78213', '78215', '78216', 
      '78217', '78218', '78219', '78220', '78221', '78222', '78223', '78224', '78225', '78226', 
      '78227', '78228', '78229', '78230', '78231', '78232', '78233', '78234', '78235', '78236', 
      '78237', '78238', '78239', '78240', '78242', '78243', '78244', '78245', '78247', '78248', 
      '78249', '78250', '78253', '78254', '78255', '78257', '78258', '78259', '78260', '78261', 
      '78266', '78284'
    ];
    
    setIsBackfilling(true);
    try {
      const result = await addZipcodesToExistingArea(
        aydenWorkerId,
        '120cf1ca-925d-4185-bad0-64c88f108042', // Ayden's San Antonio area ID
        sanAntonioZips,
        'replace_all'
      );
      
      if (result) {
        toast({
          title: "San Antonio Assignment Complete",
          description: `Assigned ${sanAntonioZips.length} ZIP codes to Ayden Alexander Alexander's San Antonio area.`
        });
        refreshData(true);
      }
    } catch (error) {
      console.error('San Antonio assignment error:', error);
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign San Antonio ZIP codes",
        variant: "destructive"
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleFortWorthAssignment = async () => {
    const warrenWorkerId = 'c6870057-c0bb-45f9-82b7-319dcf6ad84a';
    const fortWorthZips = [
      '75050', '75051', '75052', '75054', '76001', '76002', '76006', '76010', '76011', '76012',
      '76013', '76014', '76015', '76016', '76017', '76018', '76021', '76022', '76028', '76034',
      '76036', '76039', '76040', '76051', '76052', '76053', '76054', '76060', '76063', '76092',
      '76102', '76103', '76104', '76105', '76106', '76107', '76108', '76109', '76110', '76111',
      '76112', '76114', '76115', '76116', '76117', '76118', '76119', '76120', '76123', '76126',
      '76131', '76132', '76133', '76134', '76135', '76137', '76140', '76148', '76155', '76164',
      '76177', '76179', '76180', '76182', '76244', '76248', '76262'
    ];
    
    setIsBackfilling(true);
    try {
      const result = await addZipcodesToExistingArea(
        warrenWorkerId,
        'e90382e5-7de8-449e-948e-e23b360d4fcc', // Warren's Fort Worth area ID
        fortWorthZips,
        'replace_all'
      );
      
      if (result) {
        toast({
          title: "Fort Worth Assignment Complete",
          description: `Assigned ${fortWorthZips.length} ZIP codes to Warren Kenneth Joe's Fort Worth area.`
        });
        refreshData(true);
      }
    } catch (error) {
      console.error('Fort Worth assignment error:', error);
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign Fort Worth ZIP codes",
        variant: "destructive"
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleDallasAssignment = async () => {
    const chadWorkerId = 'bf62889f-4fba-47bd-94d5-362a475f995e';
    const dallasZips = [
      '75001', '75006', '75007', '75019', '75038', '75039', '75041', '75043', '75060', '75061',
      '75062', '75063', '75099', '75104', '75115', '75116', '75134', '75137', '75141', '75149',
      '75150', '75180', '75181', '75182', '75201', '75202', '75203', '75204', '75205', '75206',
      '75207', '75208', '75209', '75210', '75211', '75212', '75214', '75215', '75216', '75217',
      '75218', '75219', '75220', '75223', '75224', '75225', '75226', '75227', '75228', '75229',
      '75230', '75231', '75232', '75233', '75234', '75235', '75236', '75237', '75238', '75240',
      '75241', '75243', '75244', '75246', '75247', '75248', '75249', '75251', '75252', '75253',
      '75254', '75261', '75287', '75390'
    ];
    
    setIsBackfilling(true);
    try {
      const result = await addZipcodesToExistingArea(
        chadWorkerId,
        'd592e40a-28e4-442d-ab33-bf8c52e3fceb', // Chad's Dallas area ID
        dallasZips,
        'replace_all'
      );
      
      if (result) {
        toast({
          title: "Dallas Assignment Complete",
          description: `Assigned ${dallasZips.length} ZIP codes to Chad Walls's Dallas area.`
        });
        refreshData(true);
      }
    } catch (error) {
      console.error('Dallas assignment error:', error);
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign Dallas ZIP codes",
        variant: "destructive"
      });
    } finally {
      setIsBackfilling(false);
    }
  };
  return <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">
            Service Areas {viewMode === 'manage' ? 'Management' : 'Coverage'}
          </h1>
          <p className="text-muted-foreground">
            {viewMode === 'overview' ? 'View and manage worker service coverage across all areas' : 'Manage individual worker service areas and zip code assignments'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'manage' && <Button onClick={() => setViewMode('overview')} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Overview
            </Button>}
          <BulkZipcodeAssignment workers={filteredWorkers} onAssignZipcodes={addZipcodesToExistingArea} />
          <Button onClick={handleSanAntonioAssignment} disabled={isBackfilling || loading} variant="outline" className="bg-emerald-600/10 border-emerald-600/20 text-emerald-400 hover:bg-emerald-600/20">
            <MapPin className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-pulse' : ''}`} />
            {isBackfilling ? 'Assigning...' : 'Assign San Antonio ZIPs'}
          </Button>
          <Button onClick={handleFortWorthAssignment} disabled={isBackfilling || loading} variant="outline" className="bg-blue-600/10 border-blue-600/20 text-blue-400 hover:bg-blue-600/20">
            <MapPin className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-pulse' : ''}`} />
            {isBackfilling ? 'Assigning...' : 'Assign Fort Worth ZIPs'}
          </Button>
          <Button onClick={handleDallasAssignment} disabled={isBackfilling || loading} variant="outline" className="bg-purple-600/10 border-purple-600/20 text-purple-400 hover:bg-purple-600/20">
            <MapPin className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-pulse' : ''}`} />
            {isBackfilling ? 'Assigning...' : 'Assign Dallas ZIPs'}
          </Button>
          <Button onClick={handleBackfillZipcodes} disabled={isBackfilling || loading} variant="outline" className="bg-amber-600/10 border-amber-600/20 text-amber-400 hover:bg-amber-600/20">
            <Zap className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-pulse' : ''}`} />
            {isBackfilling ? 'Processing...' : 'Backfill ZIP Codes'}
          </Button>
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
                  {viewMode === 'overview' ? <EnhancedWorkerServiceAreasMap 
                    workers={filteredWorkers.map(worker => ({
                      ...worker,
                      service_areas: (worker.service_areas || []).map(area => ({
                        ...area,
                        zipcode_list: worker.service_zipcodes
                          ?.filter(sz => sz.service_area_id === area.id)
                          ?.map(sz => sz.zipcode) || []
                      })),
                      service_zipcodes: worker.service_zipcodes || []
                    }))} 
                    selectedWorkerId={selectedWorkerId} 
                    showInactiveAreas={showInactiveAreas}
                    showZipBoundaries={true}
                  /> : selectedWorker ? <ServiceAreaMap workerId={selectedWorkerId} isActive={true} adminMode={true} onServiceAreaUpdate={refreshData} /> : <div className="flex items-center justify-center h-full text-muted-foreground">
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
    </div>;
};