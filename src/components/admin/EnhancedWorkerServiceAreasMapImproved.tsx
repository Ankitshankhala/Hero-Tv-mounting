import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/zipMap.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Users, Eye, RefreshCw } from 'lucide-react';

interface Worker {
  id: string;
  name: string;
  email: string;
  is_active?: boolean;
  service_areas: Array<{
    id: string;
    area_name: string;
    polygon_coordinates: any;
    zipcode_list: string[];
    is_active: boolean;
    created_at: string;
  }>;
  service_zipcodes: Array<{
    zipcode: string;
    service_area_id: string;
  }>;
}

interface EnhancedWorkerServiceAreasMapProps {
  workers: Worker[];
  selectedWorkerId: string | null;
  showInactiveAreas: boolean;
  showZipBoundaries?: boolean;
}

const WORKER_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#84CC16', '#06B6D4', '#F97316', '#6B7280'
];

export const EnhancedWorkerServiceAreasMapImproved: React.FC<EnhancedWorkerServiceAreasMapProps> = ({
  workers,
  selectedWorkerId,
  showInactiveAreas,
  showZipBoundaries = true
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [computedZipCount, setComputedZipCount] = useState<number | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [32.7767, -96.7970], // Dallas-Fort Worth
      zoom: 9,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // Fix Leaflet icon URLs
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Helper function to convert polygon coordinates to GeoJSON
  const convertToGeoJSON = (polygonCoords: any) => {
    if (!polygonCoords) return null;

    // Already GeoJSON format
    if (polygonCoords.type && polygonCoords.coordinates) {
      return polygonCoords;
    }

    // Array of lat/lng objects
    if (Array.isArray(polygonCoords) && polygonCoords.length > 0) {
      const firstPoint = polygonCoords[0];
      
      if (firstPoint && (firstPoint.lat !== undefined || firstPoint.lng !== undefined)) {
        // Convert [{lat, lng}] to GeoJSON [[lng, lat]] format
        const coordinates = polygonCoords.map(point => [
          parseFloat(point.lng || point.longitude || 0),
          parseFloat(point.lat || point.latitude || 0)
        ]);
        
        // Ensure polygon is closed
        if (coordinates.length > 0 && 
            (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
             coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
          coordinates.push(coordinates[0]);
        }
        
        return {
          type: "Polygon",
          coordinates: [coordinates]
        };
      } else if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
        // Array of [lng, lat] pairs
        return {
          type: "Polygon",
          coordinates: [polygonCoords]
        };
      }
    }

    return null;
  };

  // Render service areas
  useEffect(() => {
    if (!mapRef.current) return;

    setLoading(true);
    console.log('Rendering service areas for', workers.length, 'workers');

    // Clear existing service area layers
    const layersToRemove: L.Layer[] = [];
    mapRef.current.eachLayer(layer => {
      if (layer instanceof L.GeoJSON || layer instanceof L.Polygon || layer instanceof L.CircleMarker) {
        layersToRemove.push(layer);
      }
    });
    layersToRemove.forEach(layer => mapRef.current!.removeLayer(layer));

    const filteredWorkers = selectedWorkerId 
      ? workers.filter(worker => worker.id === selectedWorkerId)
      : workers;

    let allBounds: L.LatLngBounds | null = null;
    let renderedAreas = 0;

    filteredWorkers.forEach((worker, workerIndex) => {
      const workerColor = WORKER_COLORS[workerIndex % WORKER_COLORS.length];
      
      worker.service_areas.forEach(area => {
        if (!showInactiveAreas && !area.is_active) return;

        const geoJsonData = convertToGeoJSON(area.polygon_coordinates);
        if (geoJsonData && mapRef.current) {
          try {
            const polygon = L.geoJSON(geoJsonData, {
              style: {
                color: workerColor,
                weight: 3,
                opacity: 0.8,
                fillColor: workerColor,
                fillOpacity: area.is_active ? 0.25 : 0.1,
                dashArray: area.is_active ? undefined : '8, 8'
              }
            }).addTo(mapRef.current);

            polygon.bindPopup(`
              <div class="p-3">
                <h3 class="font-bold text-sm mb-1">${area.area_name}</h3>
                <p class="text-xs text-gray-600 mb-1">Worker: ${worker.name}</p>
                <p class="text-xs mb-1">Status: ${area.is_active ? 'Active' : 'Inactive'}</p>
                <p class="text-xs">ZIP Codes: calculating...</p>
              </div>
            `);

            polygon.on('click', async () => {
              setSelectedArea({ ...area, worker });
              setComputedZipCount(null);
              try {
                // Compute full ZIP list intersecting polygon via DB
                const { data, error } = await (await import('@/integrations/supabase/client')).supabase
                  .rpc('zipcodes_intersecting_polygon', {
                    polygon_coords: area.polygon_coordinates
                  });
                if (!error) {
                  const zips = Array.isArray(data) ? data as string[] : [];
                  setComputedZipCount(zips.length);
                }
              } catch (e) {
                console.warn('Failed to compute ZIP count for popup:', e);
              }
            });

            const bounds = polygon.getBounds();
            if (bounds.isValid()) {
              if (allBounds) {
                allBounds.extend(bounds);
              } else {
                allBounds = bounds;
              }
            }

            renderedAreas++;
          } catch (error) {
            console.error('Error rendering polygon for area:', area.area_name, error);
          }
        }
      });
    });

    // Fit map to bounds
    if (allBounds && allBounds.isValid() && mapRef.current) {
      try {
        mapRef.current.fitBounds(allBounds, { 
          padding: [30, 30], 
          maxZoom: 12 
        });
      } catch (e) {
        console.warn('Could not fit bounds:', e);
      }
    } else if (filteredWorkers.length > 0 && renderedAreas === 0 && mapRef.current) {
      mapRef.current.setView([32.7767, -96.7970], 10);
    }

    console.log(`Rendered ${renderedAreas} service areas`);
    setLoading(false);

  }, [workers, selectedWorkerId, showInactiveAreas]);

  return (
    <div className="relative h-full flex isolate">
      <div className="flex-1 relative z-0">
        <div ref={mapContainerRef} className="w-full h-full" />
        
        {loading && (
          <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-md px-3 py-2 rounded-lg border shadow-lg z-[1100]">
            <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
            Loading coverage areas...
          </div>
        )}

        {!loading && workers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-[1100]">
            <div className="text-center p-6 bg-background/95 backdrop-blur-md rounded-lg border shadow-lg">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Workers Found</h3>
              <p className="text-muted-foreground">No workers with service areas are available to display.</p>
            </div>
          </div>
        )}

        {/* Compact Worker Legend - Always Visible */}
        <Card className="absolute top-4 right-4 w-64 max-h-56 bg-background/95 backdrop-blur-md shadow-xl border-2 z-[1100]">
          <CardHeader className="pb-2 px-3 py-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Users className="h-3 w-3" />
              Workers ({workers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 py-0 pb-3">
            <ScrollArea className="max-h-40">
              <div className="grid grid-cols-2 gap-1">
                {workers.map((worker, index) => {
                  const workerColor = WORKER_COLORS[index % WORKER_COLORS.length];
                  const activeAreas = worker.service_areas?.filter(area => area.is_active).length || 0;
                  const totalZipCodes = worker.service_zipcodes?.length || 0;
                  const isSelected = selectedWorkerId === worker.id;
                  
                  return (
                    <div 
                      key={worker.id} 
                      className={`flex items-center gap-1 text-xs p-1.5 rounded-sm transition-colors ${
                        isSelected ? 'bg-primary/20 border border-primary/30' : 'hover:bg-muted/70'
                      }`}
                      title={`${worker.name} - ${activeAreas} areas, ${totalZipCodes} ZIPs`}
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-sm border border-white shadow-sm flex-shrink-0" 
                        style={{ backgroundColor: workerColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate text-xs leading-tight ${isSelected ? 'text-primary' : ''}`}>
                          {worker.name.split(' ')[0]}
                        </div>
                        <div className="text-muted-foreground text-xs leading-tight">
                          {activeAreas}a•{totalZipCodes}z
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            {workers.length === 0 && (
              <div className="text-center py-3 text-muted-foreground">
                <Users className="h-6 w-6 mx-auto mb-1 opacity-50" />
                <p className="text-xs">No workers</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Side Panel for Selected Area */}
      {selectedArea && (
        <Card className="w-80 h-full bg-background/95 backdrop-blur-md border-l shadow-xl z-[1000]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{selectedArea.area_name}</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedArea(null)}
              >
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Worker</h4>
              <p className="text-sm text-muted-foreground">{selectedArea.worker.name}</p>
              <p className="text-xs text-muted-foreground">{selectedArea.worker.email}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Status</h4>
              <Badge variant={selectedArea.is_active ? 'default' : 'secondary'}>
                {selectedArea.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Coverage</h4>
              <p className="text-sm text-muted-foreground">
                {computedZipCount !== null 
                  ? `${computedZipCount} ZIP codes covered`
                  : `${selectedArea.zipcode_list?.length || 0} ZIP codes (computing full coverage...)`}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Created</h4>
              <p className="text-sm text-muted-foreground">
                {new Date(selectedArea.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};