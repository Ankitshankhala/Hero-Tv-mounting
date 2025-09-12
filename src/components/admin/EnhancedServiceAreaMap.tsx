import React, { useRef, useEffect, useState } from 'react';
import * as L from 'leaflet';
import { useAreaNameEditor } from '@/hooks/useAreaNameEditor';
import { bindEditablePopup } from '@/components/shared/EditableAreaPopup';
import AreaNameEditor from '@/components/shared/AreaNameEditor';
import { Button } from '@/components/ui/button';
import { MapPin, Edit3, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Leaflet icon fix
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
  worker_id?: string;
  zipcode_list?: string[];
}

interface Worker {
  id: string;
  name: string;
  service_areas: ServiceArea[];
}

interface EnhancedServiceAreaMapProps {
  workers: Worker[];
  selectedWorkerId?: string;
  showInactiveAreas?: boolean;
  adminMode?: boolean;
  onAreaNameUpdate?: (areaId: string, newName: string) => void;
}

const WORKER_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
];

export const EnhancedServiceAreaMap: React.FC<EnhancedServiceAreaMapProps> = ({
  workers,
  selectedWorkerId,
  showInactiveAreas = false,
  adminMode = false,
  onAreaNameUpdate
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const polygonLayersRef = useRef<Map<string, L.Polygon | L.GeoJSON>>(new Map());
  const [selectedArea, setSelectedArea] = useState<ServiceArea & { worker: Worker } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const { toast } = useToast();

  // Use our custom area name editor hook
  const { updateAreaName, validateAreaName } = useAreaNameEditor({
    adminMode,
    onSuccess: (areaId, newName) => {
      onAreaNameUpdate?.(areaId, newName);
      toast({
        title: "Success",
        description: `Area renamed to "${newName}"`,
      });
    }
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [32.7767, -96.7970], // Dallas center
      zoom: 10,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Render service areas with editable popups
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing polygons
    polygonLayersRef.current.forEach(polygon => {
      mapRef.current?.removeLayer(polygon);
    });
    polygonLayersRef.current.clear();

    const filteredWorkers = selectedWorkerId
      ? workers.filter(w => w.id === selectedWorkerId)
      : workers;

    let bounds: L.LatLngBounds | null = null;

    filteredWorkers.forEach((worker, workerIndex) => {
      const workerColor = WORKER_COLORS[workerIndex % WORKER_COLORS.length];
      
      worker.service_areas.forEach(area => {
        if (!showInactiveAreas && !area.is_active) return;

        try {
          const coords = area.polygon_coordinates as Array<{ lat: number; lng: number }>;
          if (!Array.isArray(coords) || coords.length < 3) return;

          const latLngs = coords.map(coord => [coord.lat, coord.lng] as [number, number]);
          const polygon = L.polygon(latLngs, {
            color: workerColor,
            weight: 3,
            opacity: 0.8,
            fillColor: workerColor,
            fillOpacity: area.is_active ? 0.25 : 0.1,
            dashArray: area.is_active ? undefined : '8, 8'
          });

          // Use our enhanced editable popup
          bindEditablePopup(
            polygon,
            area,
            worker,
            updateAreaName,
            area.zipcode_list?.length
          );

          // Add click handler for selection
          polygon.on('click', () => {
            setSelectedArea({ ...area, worker });
          });

          polygon.addTo(mapRef.current!);
          polygonLayersRef.current.set(`${worker.id}-${area.id}`, polygon);

          // Extend bounds
          const polygonBounds = polygon.getBounds();
          if (bounds) {
            bounds.extend(polygonBounds);
          } else {
            bounds = polygonBounds;
          }

        } catch (error) {
          console.error('Error rendering polygon for area:', area.area_name, error);
        }
      });
    });

    // Fit map to bounds if we have areas
    if (bounds && mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [workers, selectedWorkerId, showInactiveAreas, updateAreaName]);

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full rounded-lg border"
        style={{ minHeight: '400px' }}
      />

      {/* Selected area info panel */}
      {selectedArea && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border p-4 max-w-sm z-[1000]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Area Details</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedArea(null)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>

          <div className="space-y-3">
            {/* Editable area name */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Area Name
              </label>
              <AreaNameEditor
                area={selectedArea}
                onNameUpdate={updateAreaName}
                trigger="inline"
                className="w-full"
              />
            </div>

            {/* Worker info */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>Worker: {selectedArea.worker.name}</span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 text-sm">
              <span>Status:</span>
              <span className={`font-medium ${
                selectedArea.is_active ? 'text-green-600' : 'text-red-600'
              }`}>
                {selectedArea.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* ZIP codes count */}
            {selectedArea.zipcode_list?.length && (
              <div className="text-sm text-gray-600">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  {selectedArea.zipcode_list.length} ZIP codes
                </span>
              </div>
            )}

            {/* Created date */}
            <div className="text-xs text-gray-500">
              Created: {new Date(selectedArea.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      {/* Edit mode toggle */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <Button
          onClick={() => setEditMode(!editMode)}
          variant={editMode ? "default" : "outline"}
          className="shadow-lg"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg border p-3 z-[1000]">
        <h4 className="font-medium text-sm mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-blue-500 bg-blue-200"></div>
            <span>Active Areas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-gray-400 bg-gray-100 border-dashed"></div>
            <span>Inactive Areas</span>
          </div>
          <div className="text-gray-500 mt-2">
            Click areas to edit names
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedServiceAreaMap;
