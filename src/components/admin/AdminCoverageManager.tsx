import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Users, Download, Eye, EyeOff, Filter, RefreshCw } from 'lucide-react';
import { EnhancedServiceAreaMap } from './EnhancedServiceAreaMap';
import { SpatialHealthDashboard } from './SpatialHealthDashboard';
import { SpatialDataImporter } from './SpatialDataImporter';
import { useAdminServiceAreas } from '@/hooks/useAdminServiceAreas';
import { useRealtimeServiceAreas } from '@/hooks/useRealtimeServiceAreas';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
interface CoverageWorker {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
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
export const AdminCoverageManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [zipCodeFilter, setZipCodeFilter] = useState('');
  const [showInactiveWorkers, setShowInactiveWorkers] = useState(false);
  const [showInactiveAreas, setShowInactiveAreas] = useState(false);
  const {
    workers: adminWorkers,
    loading,
    fetchWorkersWithServiceAreas,
    refreshData
  } = useAdminServiceAreas();
  const workers = adminWorkers as CoverageWorker[];
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchWorkersWithServiceAreas();
  }, [fetchWorkersWithServiceAreas]);

  // Set up real-time updates with forced fresh data
  useRealtimeServiceAreas(() => {
    refreshData(true); // Force fresh data on real-time updates
  });
  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.name.toLowerCase().includes(searchTerm.toLowerCase()) || worker.email.toLowerCase().includes(searchTerm.toLowerCase()) || worker.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZipCode = !zipCodeFilter || worker.service_zipcodes.some(zip => zip.zipcode.includes(zipCodeFilter));
    const matchesActiveFilter = showInactiveWorkers || worker.is_active;
    return matchesSearch && matchesZipCode && matchesActiveFilter;
  });
  const selectedWorker = selectedWorkerId ? workers.find(w => w.id === selectedWorkerId) : null;
  const handleWorkerSelect = (workerId: string) => {
    setSelectedWorkerId(workerId === selectedWorkerId ? null : workerId);
  };
  const handleExportCSV = () => {
    const exportData = filteredWorkers.flatMap(worker => worker.service_areas.filter(area => showInactiveAreas || area.is_active).map(area => ({
      'Worker Name': worker.name,
      'Worker Email': worker.email,
      'Worker ID': worker.id,
      'Area Name': area.area_name,
      'Area Status': area.is_active ? 'Active' : 'Inactive',
      'Zip Codes': worker.service_zipcodes.filter(zip => zip.service_area_id === area.id).map(zip => zip.zipcode).join(', '),
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
  const getWorkerStats = (worker: CoverageWorker) => {
    const activeAreas = worker.service_areas.filter(area => area.is_active).length;
    const totalZipCodes = worker.service_zipcodes.length;
    return {
      activeAreas,
      totalZipCodes
    };
  };
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-200">Service Area Coverage</h2>
          <p className="text-muted-foreground">
            Manage and view worker service area assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshData(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="map" className="w-full">
        <TabsList>
          <TabsTrigger value="map">Interactive Map</TabsTrigger>
          <TabsTrigger value="list">Workers List</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="space-y-4">
          {/* Spatial Health Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <SpatialHealthDashboard />
            <SpatialDataImporter />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-400px)]">
            {/* Workers Panel */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Workers ({filteredWorkers.length})
                </CardTitle>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input placeholder="Search workers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                  </div>
                  <div className="relative">
                    <Input placeholder="Filter by zip code..." value={zipCodeFilter} onChange={e => setZipCodeFilter(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant={showInactiveWorkers ? "default" : "outline"} size="sm" onClick={() => setShowInactiveWorkers(!showInactiveWorkers)}>
                      {showInactiveWorkers ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      <span className="ml-1">Inactive</span>
                    </Button>
                    <Button variant={showInactiveAreas ? "default" : "outline"} size="sm" onClick={() => setShowInactiveAreas(!showInactiveAreas)}>
                      {showInactiveAreas ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      <span className="ml-1">Old Areas</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1 max-h-[calc(100vh-500px)] overflow-y-auto">
                  {loading ? <div className="p-4 text-center text-muted-foreground">
                      Loading workers...
                    </div> : filteredWorkers.length === 0 ? <div className="p-4 text-center text-muted-foreground">
                      No workers found
                    </div> : filteredWorkers.map(worker => {
                  const stats = getWorkerStats(worker);
                  const isSelected = selectedWorkerId === worker.id;
                  return <div key={worker.id} className={`p-3 border-l-4 cursor-pointer transition-colors ${isSelected ? 'bg-accent border-l-primary' : 'hover:bg-muted border-l-transparent'}`} onClick={() => handleWorkerSelect(worker.id)}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{worker.name}</p>
                                <Badge variant={worker.is_active ? "default" : "secondary"} className="text-xs">
                                  {worker.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {worker.email}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3 inline mr-1" />
                                  {stats.activeAreas} areas
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {stats.totalZipCodes} zip codes
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>;
                })}
                </div>
              </CardContent>
            </Card>

            {/* Map Panel */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Service Areas Map
                  {selectedWorker && <Badge variant="outline" className="ml-2">
                      {selectedWorker.name}
                    </Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <EnhancedServiceAreaMap 
                  workers={filteredWorkers.map(w => ({
                    ...w,
                    service_areas: (w.service_areas || []).map(area => ({
                      ...area,
                      zipcode_list: w.service_zipcodes
                        ?.filter(sz => sz.service_area_id === area.id)
                        ?.map(sz => sz.zipcode) || []
                    })),
                    service_zipcodes: w.service_zipcodes || []
                  }))} 
                  selectedWorkerId={selectedWorkerId} 
                  showInactiveAreas={showInactiveAreas}
                  showZctaBoundaries={true}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workers & Service Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredWorkers.map(worker => {
                const stats = getWorkerStats(worker);
                const visibleAreas = worker.service_areas.filter(area => showInactiveAreas || area.is_active);
                return <div key={worker.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{worker.name}</h3>
                          <Badge variant={worker.is_active ? "default" : "secondary"}>
                            {worker.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{stats.activeAreas} active areas</span>
                          <span>{stats.totalZipCodes} total zip codes</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Contact</p>
                          <p className="text-sm">{worker.email}</p>
                          <p className="text-sm">{worker.phone}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Service Areas</p>
                          {visibleAreas.length === 0 ? <p className="text-sm text-muted-foreground">No service areas</p> : <div className="space-y-1">
                              {visibleAreas.map(area => <div key={area.id} className="flex items-center gap-2">
                                  <Badge variant={area.is_active ? "default" : "secondary"}>
                                    {area.area_name}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {worker.service_zipcodes.filter(zip => zip.service_area_id === area.id).map(zip => zip.zipcode).slice(0, 3).join(', ')}
                                    {worker.service_zipcodes.filter(zip => zip.service_area_id === area.id).length > 3 && '...'}
                                  </span>
                                </div>)}
                            </div>}
                        </div>
                      </div>
                    </div>;
              })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>;
};