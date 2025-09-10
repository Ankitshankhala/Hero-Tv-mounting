import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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
  showInactiveAreas
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const polygonLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const [selectedAreaInfo, setSelectedAreaInfo] = useState<{
    worker: Worker;
    area: Worker['service_areas'][0];
    zipCodes: string[];
  } | null>(null);

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

          // Add click handler (removed popup to avoid duplicate UI)
          polygon.on('click', () => {
            // Get ALL zip codes for this worker, not just this area
            const allWorkerZipCodes = worker.service_zipcodes.map(zip => zip.zipcode);
            
            setSelectedAreaInfo({
              worker,
              area,
              zipCodes: allWorkerZipCodes
            });
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

  const handleCloseAreaInfo = () => {
    setSelectedAreaInfo(null);
  };

  return (
    <div className="relative h-full min-h-[500px]">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '500px' }}
      />
      
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
                <span className="font-medium">All Zip Codes for Worker ({selectedAreaInfo.zipCodes.length}):</span>
                <div className="text-xs text-muted-foreground mt-1 max-h-32 overflow-y-auto">
                  {selectedAreaInfo.zipCodes.length > 0 
                    ? selectedAreaInfo.zipCodes.sort().join(', ')
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