import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapPin, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Worker {
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

interface WorkerServiceAreasMapProps {
  workers: Worker[];
  selectedWorkerId: string | null;
  showInactiveAreas: boolean;
  adminMode?: boolean;
}

interface ZipcodeMarker {
  zipcode: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  status: 'assigned_to_worker' | 'assigned_to_other' | 'unassigned';
  assignedWorkerName?: string;
  assignedWorkerEmail?: string;
}

// Color palette for different workers
const WORKER_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

export const WorkerServiceAreasMap: React.FC<WorkerServiceAreasMapProps> = ({
  workers,
  selectedWorkerId,
  showInactiveAreas,
  adminMode = false
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const polygonLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const zipcodeMarkersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const [selectedAreaInfo, setSelectedAreaInfo] = useState<{
    worker: Worker;
    area: Worker['service_areas'][0];
    zipCodes: string[];
  } | null>(null);
  const [showZipOverlays, setShowZipOverlays] = useState(false);
  const [zipcodeMarkers, setZipcodeMarkers] = useState<ZipcodeMarker[]>([]);
  const [loadingZips, setLoadingZips] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795], // Center of US
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update polygons when workers or filters change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing polygons
    polygonLayersRef.current.forEach(polygon => {
      mapRef.current?.removeLayer(polygon);
    });
    polygonLayersRef.current.clear();

    const workersToShow = selectedWorkerId 
      ? workers.filter(w => w.id === selectedWorkerId)
      : workers;

    let bounds: L.LatLngBounds | null = null;

    workersToShow.forEach((worker, workerIndex) => {
      const workerColor = WORKER_COLORS[workerIndex % WORKER_COLORS.length];
      
      worker.service_areas.forEach((area) => {
        // Skip inactive areas unless specifically shown
        if (!area.is_active && !showInactiveAreas) return;

        try {
          const coordinates = area.polygon_coordinates;
          if (!coordinates || !Array.isArray(coordinates)) return;

          // Convert coordinates to LatLng array
          const latLngs: L.LatLngExpression[] = coordinates.map((coord: any) => {
            if (coord.lat !== undefined && coord.lng !== undefined) {
              return [coord.lat, coord.lng] as L.LatLngTuple;
            }
            // Handle alternative coordinate formats
            if (Array.isArray(coord) && coord.length >= 2) {
              return [coord[0], coord[1]] as L.LatLngTuple;
            }
            return [0, 0] as L.LatLngTuple; // Fallback
          }).filter((coord: L.LatLngTuple) => coord[0] !== 0 || coord[1] !== 0);

          if (latLngs.length < 3) return; // Need at least 3 points for a polygon

          const polygon = L.polygon(latLngs, {
            color: workerColor,
            fillColor: workerColor,
            fillOpacity: area.is_active ? 0.3 : 0.1,
            weight: area.is_active ? 2 : 1,
            opacity: area.is_active ? 0.8 : 0.4,
            dashArray: area.is_active ? undefined : '5, 5',
          });

          // Get zip codes for this area
          const areaZipCodes = worker.service_zipcodes
            .filter(zip => zip.service_area_id === area.id)
            .map(zip => zip.zipcode);

          // Add popup
          const popupContent = `
            <div class="p-2">
              <h4 class="font-semibold text-sm">${worker.name}</h4>
              <p class="text-xs text-gray-600">${area.area_name}</p>
              <p class="text-xs mt-1">
                <strong>Status:</strong> ${area.is_active ? 'Active' : 'Inactive'}
              </p>
              <p class="text-xs">
                <strong>Zip Codes:</strong> ${areaZipCodes.join(', ') || 'None'}
              </p>
              <p class="text-xs">
                <strong>Created:</strong> ${new Date(area.created_at).toLocaleDateString()}
              </p>
            </div>
          `;

          polygon.bindPopup(popupContent);

          // Add click handler
          polygon.on('click', () => {
            setSelectedAreaInfo({
              worker,
              area,
              zipCodes: areaZipCodes
            });
            
            // Load ZIP overlays if enabled
            if (adminMode && showZipOverlays && area.polygon_coordinates) {
              loadZipCodesInPolygon(area.polygon_coordinates);
            }
          });

          polygon.addTo(mapRef.current!);
          polygonLayersRef.current.set(`${worker.id}-${area.id}`, polygon);

          // Add to bounds
          if (!bounds) {
            bounds = polygon.getBounds();
          } else {
            bounds.extend(polygon.getBounds());
          }
        } catch (error) {
          console.warn('Error processing polygon coordinates:', error, area);
        }
      });
    });

    // Fit map to bounds if we have polygons
    if (bounds && mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [workers, selectedWorkerId, showInactiveAreas]);

  // Update ZIP markers when overlay is toggled or markers change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing ZIP markers
    zipcodeMarkersRef.current.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    zipcodeMarkersRef.current.clear();

    if (!showZipOverlays || !adminMode) return;

    // Add ZIP markers
    zipcodeMarkers.forEach(zipMarker => {
      let color = '#6B7280'; // gray for unassigned
      let fillOpacity = 0.6;
      
      if (zipMarker.status === 'assigned_to_worker') {
        color = '#10B981'; // green for assigned to selected worker
        fillOpacity = 0.8;
      } else if (zipMarker.status === 'assigned_to_other') {
        color = '#EF4444'; // red for assigned to other worker
        fillOpacity = 0.7;
      } else {
        color = '#F59E0B'; // yellow for unassigned
        fillOpacity = 0.6;
      }

      const marker = L.circleMarker([zipMarker.lat, zipMarker.lng], {
        radius: 4,
        color: '#FFFFFF',
        weight: 1,
        fillColor: color,
        fillOpacity,
        className: zipMarker.status === 'unassigned' ? 'cursor-pointer' : ''
      });

      // Add popup
      const popupContent = `
        <div class="p-2 text-xs">
          <div class="font-semibold">${zipMarker.zipcode}</div>
          <div class="text-gray-600">${zipMarker.city}, ${zipMarker.state}</div>
          <div class="mt-1">
            <span class="inline-block px-2 py-1 rounded text-xs ${
              zipMarker.status === 'assigned_to_worker' ? 'bg-green-100 text-green-800' :
              zipMarker.status === 'assigned_to_other' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }">
              ${zipMarker.status === 'assigned_to_worker' ? 'Assigned to Worker' :
                zipMarker.status === 'assigned_to_other' ? `Assigned to ${zipMarker.assignedWorkerName}` :
                'Unassigned - Click to assign'
              }
            </span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Add click handler for unassigned ZIP codes
      if (zipMarker.status === 'unassigned') {
        marker.on('click', () => {
          handleZipAssignment(zipMarker.zipcode);
        });
      }

      marker.addTo(mapRef.current!);
      zipcodeMarkersRef.current.set(zipMarker.zipcode, marker);
    });
  }, [showZipOverlays, zipcodeMarkers, adminMode]);

  const handleCloseAreaInfo = () => {
    setSelectedAreaInfo(null);
  };

  // Load ZIP codes for overlay
  const loadZipCodesInPolygon = async (polygon: any[]) => {
    if (!adminMode || !selectedWorkerId || !showZipOverlays) return;
    
    setLoadingZips(true);
    try {
      const { data, error } = await supabase.functions.invoke('zipcodes-in-area', {
        body: { polygon, selectedWorkerId }
      });

      if (error) throw error;
      if (data?.success) {
        setZipcodeMarkers(data.zipcodes || []);
      }
    } catch (error) {
      console.error('Error loading ZIP codes:', error);
      toast.error('Failed to load ZIP codes');
    } finally {
      setLoadingZips(false);
    }
  };

  // Handle ZIP code assignment
  const handleZipAssignment = async (zipcode: string) => {
    if (!selectedWorkerId || !selectedAreaInfo?.area.id) {
      toast.error('No active service area selected');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-service-area-manager', {
        body: {
          action: 'assign_zipcodes_to_area',
          workerId: selectedWorkerId,
          areaId: selectedAreaInfo.area.id,
          zipcodesOnly: [zipcode]
        }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(`Assigned ZIP ${zipcode} to worker`);
        // Refresh ZIP overlays
        const selectedPolygon = selectedAreaInfo.area.polygon_coordinates;
        if (selectedPolygon) {
          await loadZipCodesInPolygon(selectedPolygon);
        }
      }
    } catch (error) {
      console.error('Error assigning ZIP code:', error);
      toast.error('Failed to assign ZIP code');
    }
  };

  // Handle bulk assignment
  const handleBulkAssignment = async () => {
    if (!selectedWorkerId || !selectedAreaInfo?.area.id || !selectedAreaInfo.area.polygon_coordinates) {
      toast.error('No active service area selected');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-service-area-manager', {
        body: {
          action: 'assign_all_unassigned_in_polygon',
          workerId: selectedWorkerId,
          areaId: selectedAreaInfo.area.id,
          polygon: selectedAreaInfo.area.polygon_coordinates
        }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(data.message);
        // Refresh ZIP overlays
        await loadZipCodesInPolygon(selectedAreaInfo.area.polygon_coordinates);
      }
    } catch (error) {
      console.error('Error bulk assigning ZIP codes:', error);
      toast.error('Failed to assign ZIP codes');
    }
  };

  return (
    <div className="relative h-full min-h-[500px]">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '500px' }}
      />
      
      {/* Admin ZIP Overlay Controls */}
      {adminMode && (
        <Card className="absolute top-4 left-4 z-[1000] shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Switch 
                id="zip-overlay" 
                checked={showZipOverlays}
                onCheckedChange={setShowZipOverlays}
                disabled={loadingZips}
              />
              <Label htmlFor="zip-overlay" className="text-sm font-medium">
                Show ZIP overlays {loadingZips && '(loading...)'}
              </Label>
            </div>
            
            {showZipOverlays && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Assigned to worker</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Assigned to others</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Unassigned (clickable)</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected Area Info Panel */}
      {selectedAreaInfo && (
        <Card className="absolute top-4 right-4 max-w-sm z-[1000] shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">{selectedAreaInfo.worker.name}</h4>
              <button 
                onClick={handleCloseAreaInfo}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Area:</span> {selectedAreaInfo.area.area_name}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <Badge variant={selectedAreaInfo.area.is_active ? "default" : "secondary"}>
                  {selectedAreaInfo.area.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              
              <div>
                <span className="font-medium">Contact:</span>
                <div className="text-xs text-muted-foreground mt-1">
                  <div>{selectedAreaInfo.worker.email}</div>
                  <div>{selectedAreaInfo.worker.phone}</div>
                </div>
              </div>
              
              <div>
                <span className="font-medium">Zip Codes ({selectedAreaInfo.zipCodes.length}):</span>
                <div className="text-xs text-muted-foreground mt-1 max-h-20 overflow-y-auto">
                  {selectedAreaInfo.zipCodes.length > 0 
                    ? selectedAreaInfo.zipCodes.join(', ')
                    : 'No zip codes assigned'
                  }
                </div>
              </div>
              
              <div>
                <span className="font-medium">Created:</span> {' '}
                <span className="text-muted-foreground">
                  {new Date(selectedAreaInfo.area.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Admin bulk assignment */}
              {adminMode && showZipOverlays && selectedAreaInfo.area.is_active && (
                <div className="pt-2 border-t">
                  <Button 
                    size="sm" 
                    onClick={handleBulkAssignment}
                    className="w-full"
                    variant="outline"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Assign all unassigned in area
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {workers.length > 1 && !selectedWorkerId && (
        <Card className="absolute bottom-4 left-4 z-[1000] shadow-lg">
          <CardContent className="p-3">
            <h5 className="font-medium text-sm mb-2">Workers</h5>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {workers.slice(0, 10).map((worker, index) => (
                <div key={worker.id} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-sm border"
                    style={{ 
                      backgroundColor: WORKER_COLORS[index % WORKER_COLORS.length],
                      opacity: 0.7
                    }}
                  />
                  <span className="truncate max-w-32" title={worker.name}>
                    {worker.name}
                  </span>
                </div>
              ))}
              {workers.length > 10 && (
                <div className="text-xs text-muted-foreground">
                  ... and {workers.length - 10} more
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};