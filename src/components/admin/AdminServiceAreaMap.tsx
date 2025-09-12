import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MapPin, Save, Trash2, Edit3, Search, MapPinCheck, Globe, Loader2, Plus, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminServiceAreas } from '@/hooks/useAdminServiceAreas';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ServiceArea {
  id: string;
  area_name: string;
  polygon_coordinates: any;
  is_active: boolean;
  created_at: string;
}

interface AdminServiceAreaMapProps {
  workerId: string;
  workerName: string;
  onServiceAreaUpdate?: () => void;
  onServiceAreaCreated?: () => void;
  isActive?: boolean;
}

const AdminServiceAreaMap = ({ 
  workerId, 
  workerName, 
  onServiceAreaUpdate, 
  onServiceAreaCreated, 
  isActive = true 
}: AdminServiceAreaMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areaName, setAreaName] = useState('Service Area');
  const [currentPolygon, setCurrentPolygon] = useState<Array<{ lat: number; lng: number }> | null>(null);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState<string | null>(null);
  const [showAreaSelection, setShowAreaSelection] = useState(false);
  const [areaSelectionMode, setAreaSelectionMode] = useState<'existing' | 'new'>('new');
  const [selectedExistingArea, setSelectedExistingArea] = useState<ServiceArea | null>(null);
  
  const { toast } = useToast();
  const { 
    createServiceAreaForWorker, 
    updateServiceAreaForWorker, 
    deleteWorkerServiceArea,
    refreshData 
  } = useAdminServiceAreas();

  // Initialize map
  useEffect(() => {
    if (!isActive) return;
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current!, {
      center: [39.8283, -98.5795], // Center of US
      zoom: 4,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapRef.current = map;

    // Initialize drawn items layer
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Initialize draw control
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          drawError: {
            color: '#e1e100',
            message: '<strong>Error:</strong> shape edges cannot cross!'
          },
          shapeOptions: {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.2
          }
        },
        rectangle: {
          shapeOptions: {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.2
          }
        },
        circle: false,
        marker: false,
        polyline: false,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Handle drawing events
    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      
      if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        const latLngs = layer.getLatLngs();
        const coords = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
        const coordinates = (coords as L.LatLng[]).map((point: L.LatLng) => ({
          lat: point.lat,
          lng: point.lng
        }));
        setCurrentPolygon(coordinates);
        setShowAreaSelection(true);
        
        // Set default selection based on existing areas
        if (serviceAreas.length > 0) {
          const activeAreas = serviceAreas.filter(area => area.is_active);
          if (activeAreas.length > 0) {
            setAreaSelectionMode('existing');
            setSelectedExistingArea(activeAreas[0]);
          } else {
            setAreaSelectionMode('new');
            setSelectedExistingArea(null);
          }
        } else {
          setAreaSelectionMode('new');
          setSelectedExistingArea(null);
        }
      }
    });

    map.on(L.Draw.Event.EDITED, (e: any) => {
      const layers = e.layers;
      layers.eachLayer((layer: any) => {
        if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
          const latLngs = layer.getLatLngs();
          const coords = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
          const coordinates = (coords as L.LatLng[]).map((point: L.LatLng) => ({
            lat: point.lat,
            lng: point.lng
          }));
          setCurrentPolygon(coordinates);
        }
      });
    });

    map.on(L.Draw.Event.DELETED, () => {
      setCurrentPolygon(null);
      setEditingArea(null);
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => map.invalidateSize());
    });
    if (mapContainerRef.current) ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
    };
  }, [isActive, serviceAreas]);

  // Load service areas
  useEffect(() => {
    if (!workerId) return;
    loadServiceAreas();
  }, [workerId]);

  const loadServiceAreas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worker_service_areas')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServiceAreas(data || []);
    } catch (error) {
      console.error('Error loading service areas:', error);
      toast({
        title: "Error",
        description: "Failed to load service areas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolygon = async () => {
    if (!currentPolygon || !workerId) return;

    setSaving(true);
    try {
      const polygonData = {
        type: 'Polygon',
        coordinates: [[...currentPolygon.map(p => [p.lng, p.lat]), [currentPolygon[0].lng, currentPolygon[0].lat]]]
      };

      if (areaSelectionMode === 'existing' && selectedExistingArea) {
        // Update existing area
        await updateServiceAreaForWorker(selectedExistingArea.id, {
          polygon_coordinates: polygonData
        });
        toast({
          title: "Success",
          description: `Updated ${selectedExistingArea.area_name}`,
        });
      } else {
        // Create new area
        await createServiceAreaForWorker(workerId, areaName, polygonData);
        toast({
          title: "Success",
          description: `Created ${areaName}`,
        });
      }

      // Clear current polygon and refresh
      setCurrentPolygon(null);
      setShowAreaSelection(false);
      drawnItemsRef.current?.clearLayers();
      await loadServiceAreas();
      onServiceAreaUpdate?.();
      onServiceAreaCreated?.();
    } catch (error) {
      console.error('Error saving polygon:', error);
      toast({
        title: "Error",
        description: "Failed to save service area",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    try {
      await deleteWorkerServiceArea(areaId);
      toast({
        title: "Success",
        description: "Service area deleted",
      });
      await loadServiceAreas();
      onServiceAreaUpdate?.();
    } catch (error) {
      console.error('Error deleting area:', error);
      toast({
        title: "Error",
        description: "Failed to delete service area",
        variant: "destructive",
      });
    }
  };

  const displayPolygonOnMap = (polygonCoords: any, area: ServiceArea) => {
    if (!mapRef.current || !drawnItemsRef.current) return;

    // Clear existing layers
    drawnItemsRef.current.clearLayers();

    try {
      const polygon = L.geoJSON(polygonCoords, {
        style: {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.8,
          fillColor: '#3b82f6',
          fillOpacity: 0.2
        }
      });

      polygon.addTo(drawnItemsRef.current);
      setEditingArea(area);
      setCurrentPolygon(
        polygonCoords.coordinates[0].map((coord: [number, number]) => ({
          lat: coord[1],
          lng: coord[0]
        }))
      );

      // Fit map to polygon
      if (polygon.getBounds().isValid()) {
        mapRef.current.fitBounds(polygon.getBounds(), { padding: [20, 20] });
      }
    } catch (error) {
      console.error('Error displaying polygon:', error);
    }
  };

  const cancelDrawing = () => {
    setCurrentPolygon(null);
    setShowAreaSelection(false);
    drawnItemsRef.current?.clearLayers();
  };

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Area Map - {workerName}
            <Badge variant="outline" className="ml-auto">
              Admin Mode
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div 
            ref={mapContainerRef}
            className="h-96 w-full rounded-b-lg"
            style={{ minHeight: '400px' }}
          />
        </CardContent>
      </Card>

      {/* Area Selection Modal */}
      {showAreaSelection && currentPolygon && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPinCheck className="h-5 w-5 text-blue-600" />
              Save Service Area
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Area Selection</Label>
              <div className="flex gap-2">
                <Button
                  variant={areaSelectionMode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAreaSelectionMode('new')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Area
                </Button>
                <Button
                  variant={areaSelectionMode === 'existing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAreaSelectionMode('existing')}
                  disabled={serviceAreas.length === 0}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Update Existing
                </Button>
              </div>
            </div>

            {areaSelectionMode === 'new' && (
              <div className="space-y-2">
                <Label htmlFor="areaName">Area Name</Label>
                <Input
                  id="areaName"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="Enter area name"
                />
              </div>
            )}

            {areaSelectionMode === 'existing' && (
              <div className="space-y-2">
                <Label>Select Area to Update</Label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={selectedExistingArea?.id || ''}
                  onChange={(e) => {
                    const area = serviceAreas.find(a => a.id === e.target.value);
                    setSelectedExistingArea(area || null);
                  }}
                >
                  <option value="">Select an area...</option>
                  {serviceAreas.map(area => (
                    <option key={area.id} value={area.id}>
                      {area.area_name} {!area.is_active && '(Inactive)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSavePolygon}
                disabled={saving || (areaSelectionMode === 'existing' && !selectedExistingArea)}
                className="flex-1"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {areaSelectionMode === 'new' ? 'Create Area' : 'Update Area'}
              </Button>
              <Button variant="outline" onClick={cancelDrawing}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Areas List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Areas ({serviceAreas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : serviceAreas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No service areas defined</p>
              <p className="text-sm">Draw a polygon on the map to create one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {serviceAreas.map(area => (
                <div
                  key={area.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{area.area_name}</span>
                      <Badge variant={area.is_active ? 'default' : 'secondary'}>
                        {area.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created {new Date(area.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {area.polygon_coordinates && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => displayPolygonOnMap(area.polygon_coordinates, area)}
                        title="Edit polygon area"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAreaToDelete(area.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Delete Service Area
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{area.area_name}"? This action cannot be undone.
                            All associated ZIP codes will also be removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteArea(area.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Area
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminServiceAreaMap;
