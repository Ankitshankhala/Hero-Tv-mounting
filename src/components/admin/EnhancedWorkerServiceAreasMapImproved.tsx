import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/zipMap.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Users, RefreshCw } from 'lucide-react';
import { ServiceAreaPopup } from './ServiceAreaPopup';
import { unifiedZctaManager } from '@/services/unifiedZctaManager';
import { polygon, bbox, intersect } from '@turf/turf';

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
  const [computedZipCodes, setComputedZipCodes] = useState<string[]>([]);
  const [zipCodeLoading, setZipCodeLoading] = useState(false);
  const [highlightedPolygon, setHighlightedPolygon] = useState<L.GeoJSON | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zctaLoaded, setZctaLoaded] = useState(false);

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

  // Load ZCTA data on component mount
  useEffect(() => {
    const loadZctaData = async () => {
      try {
        await unifiedZctaManager.loadZctaData();
        setZctaLoaded(true);
        console.log('ZCTA data loaded successfully');
      } catch (error) {
        console.warn('Failed to load ZCTA data:', error);
      }
    };
    
    loadZctaData();
  }, []);

  // Helper function to compute ZCTA ZIP codes for a polygon using bounds-based approximation
  const computeZctaZipCodes = async (polygonGeoJson: any): Promise<string[]> => {
    if (!zctaLoaded || !unifiedZctaManager.isReady()) {
      console.warn('ZCTA data not ready, using fallback method');
      return [];
    }

    try {
      const spatialIndex = unifiedZctaManager.getSpatialIndex();
      if (!spatialIndex || spatialIndex.length === 0) {
        console.warn('ZCTA spatial index is empty');
        return [];
      }

      const intersectingZips: string[] = [];
      
      // Get polygon bounds for filtering
      const servicePolygon = polygon(polygonGeoJson.coordinates);
      const serviceBbox = bbox(servicePolygon);
      const [minLng, minLat, maxLng, maxLat] = serviceBbox;
      
      // Use bounds-based approach for performance - check bbox overlap
      spatialIndex.forEach((entry) => {
        try {
          const [entryMinLng, entryMinLat, entryMaxLng, entryMaxLat] = entry.bbox;
          
          // Check if bounding boxes overlap (simpler and faster)
          if (minLng <= entryMaxLng && maxLng >= entryMinLng &&
              minLat <= entryMaxLat && maxLat >= entryMinLat) {
            intersectingZips.push(entry.zipcode);
          }
        } catch (error) {
          console.warn(`Error checking overlap for ZIP ${entry.zipcode}:`, error);
        }
      });

      return intersectingZips.sort();
    } catch (error) {
      console.error('Error computing ZCTA ZIP codes:', error);
      return [];
    }
  };

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

            polygon.on('click', async (e) => {
              // Clear previous highlight
              if (highlightedPolygon) {
                highlightedPolygon.setStyle({
                  weight: 3,
                  opacity: 0.8
                });
              }
              
              // Highlight selected polygon
              polygon.setStyle({
                weight: 5,
                opacity: 1.0
              });
              setHighlightedPolygon(polygon);
              
              // Set popup position from click event (convert to viewport coordinates)
              const containerPoint = e.containerPoint;
              const mapContainer = mapContainerRef.current;
              if (mapContainer) {
                const containerRect = mapContainer.getBoundingClientRect();
                setPopupPosition({ 
                  x: containerRect.left + containerPoint.x + 20, 
                  y: containerRect.top + containerPoint.y - 10 
                });
              }
              
              setSelectedArea({ ...area, worker });
              setZipCodeLoading(true);
              setComputedZipCodes([]);
              
              try {
                // Use ZCTA data for accurate ZIP code computation
                const geoJsonData = convertToGeoJSON(area.polygon_coordinates);
                if (geoJsonData && zctaLoaded) {
                  const zctaZips = await computeZctaZipCodes(geoJsonData);
                  setComputedZipCodes(zctaZips);
                } else {
                  // Fallback to database function if ZCTA not available
                  const { data, error } = await (await import('@/integrations/supabase/client')).supabase
                    .rpc('zipcodes_intersecting_polygon', {
                      polygon_coords: area.polygon_coordinates
                    });
                  if (!error && data) {
                    const zips = Array.isArray(data) ? data as string[] : [];
                    setComputedZipCodes(zips.sort());
                  }
                }
              } catch (e) {
                console.warn('Failed to compute ZIP codes:', e);
                setComputedZipCodes([]);
              } finally {
                setZipCodeLoading(false);
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

      {/* Enhanced Popup for Selected Area */}
      {selectedArea && (
        <ServiceAreaPopup
          area={selectedArea}
          zipCodes={computedZipCodes}
          loading={zipCodeLoading}
          position={popupPosition}
          onClose={() => {
            setSelectedArea(null);
            setComputedZipCodes([]);
            // Clear polygon highlight
            if (highlightedPolygon) {
              highlightedPolygon.setStyle({
                weight: 3,
                opacity: 0.8
              });
              setHighlightedPolygon(null);
            }
          }}
        />
      )}
    </div>
  );
};