import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import concaveman from 'concaveman';

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

interface ZipCoordinate {
  zipcode: string;
  latitude: number;
  longitude: number;
  city: string;
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
  const polygonLayersRef = useRef<Map<string, L.Layer>>(new Map());
  const [selectedAreaInfo, setSelectedAreaInfo] = useState<{
    worker: Worker;
    area: Worker['service_areas'][0];
    zipCodes: string[];
  } | null>(null);
  const [showZipOverlays, setShowZipOverlays] = useState<boolean>(true);

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

    // Add zoom event listener for dynamic ZIP labels
    map.on('zoomend', () => {
      const currentZoom = map.getZoom();
      
      // Update ZIP marker visibility and labels based on zoom
      if (polygonLayersRef.current instanceof Map) {
        polygonLayersRef.current.forEach((layer, key) => {
          if (key.includes('-zipcode') && layer instanceof L.CircleMarker) {
            const baseRadius = currentZoom > 8 ? 12 : 8;
            layer.setStyle({ radius: baseRadius });
            
            // Toggle permanent labels based on zoom level
            const tooltip = layer.getTooltip();
            if (tooltip) {
              layer.unbindTooltip();
              const zipcode = key.split('-').pop();
              const content = tooltip.getContent() as string;
              layer.bindTooltip(content, {
                permanent: currentZoom > 11,
                direction: 'top',
                className: 'zip-label-tooltip',
                offset: [0, -8]
              });
            }
          }
        });
      }
    });

    mapRef.current = map;

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Geocode a ZIP code using Zippopotam.us API
  const geocodeZipcode = async (zipcode: string): Promise<ZipCoordinate | null> => {
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zipcode}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const place = data.places?.[0];
      if (!place) return null;
      
      return {
        zipcode,
        latitude: parseFloat(place.latitude),
        longitude: parseFloat(place.longitude),
        city: place['place name'] || 'Unknown'
      };
    } catch (error) {
      console.warn(`Failed to geocode ZIP ${zipcode}:`, error);
      return null;
    }
  };

  // Function to generate concave hull from ZIP coordinates
  const generateConcaveHull = (zipCoordinates: ZipCoordinate[]) => {
    if (zipCoordinates.length < 3) return null;
    
    const points = zipCoordinates
      .filter(zip => zip.latitude && zip.longitude)
      .map(zip => [zip.longitude, zip.latitude]);
    
    if (points.length < 3) return null;
    
    try {
      // Generate concave hull with appropriate concavity
      const concavity = points.length > 10 ? 2 : 1.5;
      const hull = concaveman(points, concavity);
      
      // Convert back to lat/lng format for Leaflet
      return hull.map(point => [point[1], point[0]]);
    } catch (error) {
      console.error('Error generating concave hull:', error);
      return null;
    }
  };

  // Fetch ZIP coordinates from database and geocode missing ones
  const fetchZipCoordinatesAndRender = async (
    zipCodes: string[], 
    workerColor: string, 
    area: Worker['service_areas'][0], 
    worker: Worker,
    currentBounds: L.LatLngBounds | null
  ) => {
    if (!mapRef.current || zipCodes.length === 0) return currentBounds;

    try {
      // First try to get coordinates from database
      const { data: zipData, error } = await supabase
        .from('us_zip_codes')
        .select('zipcode, latitude, longitude, city')
        .in('zipcode', zipCodes);

      if (error) {
        console.warn('Error fetching ZIP coordinates:', error);
      }

      const foundZips = zipData || [];
      const missingZips = zipCodes.filter(zip => 
        !foundZips.some(found => found.zipcode === zip)
      );

      // Geocode missing ZIPs using external API (limit concurrency to 3)
      const geocodedZips: ZipCoordinate[] = [];
      if (missingZips.length > 0) {
        console.log(`Geocoding ${missingZips.length} missing ZIPs for ${area.area_name}`);
        for (let i = 0; i < missingZips.length; i += 3) {
          const batch = missingZips.slice(i, i + 3);
          const batchResults = await Promise.all(
            batch.map(zip => geocodeZipcode(zip))
          );
          geocodedZips.push(...batchResults.filter(Boolean) as ZipCoordinate[]);
        }
      }

      // Combine database and geocoded results
      const allCoordinates = [
        ...foundZips.filter(z => z.latitude && z.longitude),
        ...geocodedZips
      ];

      let newBounds = currentBounds;

      // Create enhanced ZIP markers with better visibility
      allCoordinates.forEach((zip) => {
        if (zip.latitude && zip.longitude) {
          const currentZoom = mapRef.current!.getZoom();
          const baseRadius = currentZoom > 8 ? 10 : 8;
          
          const zipMarker = L.circleMarker([zip.latitude, zip.longitude], {
            color: '#000000', // Dark border for better contrast
            fillColor: workerColor,
            fillOpacity: area.is_active ? 0.9 : 0.5,
            radius: baseRadius,
            weight: 2,
            opacity: 1
          });

          // Enhanced hover effects
          zipMarker.on('mouseover', () => {
            zipMarker.setStyle({
              radius: baseRadius + 3,
              fillOpacity: 1,
              weight: 3
            });
          });

          zipMarker.on('mouseout', () => {
            zipMarker.setStyle({
              radius: baseRadius,
              fillOpacity: area.is_active ? 0.9 : 0.5,
              weight: 2
            });
          });

          // Add click handler
          zipMarker.on('click', () => {
            setSelectedAreaInfo({
              worker,
              area,
              zipCodes: zipCodes.sort()
            });
          });

          // Enhanced tooltip with permanent label at high zoom
          const showPermanentLabel = currentZoom > 10;
          zipMarker.bindTooltip(`${zip.zipcode}<br>${zip.city}`, {
            permanent: showPermanentLabel,
            direction: 'top',
            className: 'zip-label-tooltip',
            offset: [0, -5]
          });

          zipMarker.addTo(mapRef.current!);
          if (polygonLayersRef.current instanceof Map) {
            polygonLayersRef.current.set(`${worker.id}-${area.id}-${zip.zipcode}`, zipMarker);
          }

          // Add to bounds
          if (!newBounds) {
            newBounds = L.latLngBounds([zip.latitude, zip.longitude], [zip.latitude, zip.longitude]);
          } else {
            newBounds.extend([zip.latitude, zip.longitude]);
          }
        }
      });

      // Generate and render polygon if we have enough coordinates
      if (allCoordinates.length >= 3) {
        const hullCoords = generateConcaveHull(allCoordinates);
        if (hullCoords) {
          const polygon = L.polygon(hullCoords, {
            color: workerColor,
            weight: 2,
            opacity: 0.8,
            fillColor: workerColor,
            fillOpacity: area.is_active ? 0.25 : 0.1,
            dashArray: area.is_active ? undefined : '5, 5'
          });
          
          // Add click handler to polygon
          polygon.on('click', () => {
            setSelectedAreaInfo({
              worker,
              area,
              zipCodes: zipCodes.sort()
            });
          });
          
          polygon.bindTooltip(`${area.area_name}<br>${allCoordinates.length} ZIP codes`, {
            permanent: false,
            direction: 'center'
          });
          
          polygon.addTo(mapRef.current!);
          if (polygonLayersRef.current instanceof Map) {
            polygonLayersRef.current.set(`${worker.id}-${area.id}-polygon`, polygon);
          }
          
          // Extend bounds to include polygon
          if (!newBounds) {
            newBounds = polygon.getBounds();
          } else {
            newBounds.extend(polygon.getBounds());
          }
        }
      }

      return newBounds;
    } catch (error) {
      console.warn('Error processing ZIP coordinates:', error);
      return currentBounds;
    }
  };

  // Generate convex hull polygon from ZIP coordinates  
  const syncPolygonToZips = async (area: Worker['service_areas'][0], worker: Worker) => {
    const areaZipCodes = worker.service_zipcodes
      .filter(zip => zip.service_area_id === area.id)
      .map(zip => zip.zipcode);

    if (areaZipCodes.length < 3) {
      alert('Need at least 3 ZIP codes to generate a polygon');
      return;
    }

    try {
      const { data: zipData, error } = await supabase
        .from('us_zip_codes')
        .select('zipcode, latitude, longitude')
        .in('zipcode', areaZipCodes);

      const foundZips = zipData || [];
      const missingZips = areaZipCodes.filter(zip => 
        !foundZips.some(found => found.zipcode === zip)
      );

      // Geocode missing ZIPs
      const geocodedZips: { zipcode: string; latitude: number; longitude: number }[] = [];
      if (missingZips.length > 0) {
        for (let i = 0; i < missingZips.length; i += 3) {
          const batch = missingZips.slice(i, i + 3);
          const batchResults = await Promise.all(
            batch.map(async (zip) => {
              const result = await geocodeZipcode(zip);
              return result ? { zipcode: zip, latitude: result.latitude, longitude: result.longitude } : null;
            })
          );
          geocodedZips.push(...batchResults.filter(Boolean) as any[]);
        }
      }

      const allZipData = [
        ...foundZips.filter(z => z.latitude && z.longitude),
        ...geocodedZips
      ];

      if (allZipData.length < 3) {
        alert('Could not fetch enough ZIP coordinates to generate polygon');
        return;
      }

      // Simple convex hull algorithm (gift wrapping)
      const points = allZipData.map(z => ({ lat: z.latitude, lng: z.longitude }));
      const hull = calculateConvexHull(points);

      if (hull.length >= 3) {
        // Update the service area with the new polygon
        const { error: updateError } = await supabase
          .from('worker_service_areas')
          .update({ 
            polygon_coordinates: hull,
            updated_at: new Date().toISOString()
          })
          .eq('id', area.id);

        if (updateError) {
          console.error('Error updating polygon:', updateError);
          alert('Failed to update polygon');
        } else {
          alert('Polygon synced successfully!');
          // Trigger a re-render by updating the worker data
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error syncing polygon:', error);
      alert('Failed to sync polygon');
    }
  };

  // Simple convex hull calculation
  const calculateConvexHull = (points: { lat: number; lng: number }[]): { lat: number; lng: number }[] => {
    if (points.length < 3) return points;

    // Find the bottommost point (or leftmost in case of tie)
    let start = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].lat < points[start].lat || 
         (points[i].lat === points[start].lat && points[i].lng < points[start].lng)) {
        start = i;
      }
    }

    const hull: { lat: number; lng: number }[] = [];
    let current = start;

    do {
      hull.push(points[current]);
      let next = (current + 1) % points.length;

      for (let i = 0; i < points.length; i++) {
        if (orientation(points[current], points[i], points[next]) === 2) {
          next = i;
        }
      }

      current = next;
    } while (current !== start);

    return hull;
  };

  // Helper function for convex hull
  const orientation = (p: { lat: number; lng: number }, q: { lat: number; lng: number }, r: { lat: number; lng: number }): number => {
    const val = (q.lng - p.lng) * (r.lat - q.lat) - (q.lat - p.lat) * (r.lng - q.lng);
    if (val === 0) return 0;
    return val > 0 ? 1 : 2;
  };

  // Update polygons when workers or filters change
  useEffect(() => {
    if (!mapRef.current || !polygonLayersRef.current) return;

    // Clear existing polygons and markers
    if (polygonLayersRef.current instanceof Map) {
      polygonLayersRef.current.forEach(layer => {
        mapRef.current?.removeLayer(layer);
      });
      polygonLayersRef.current.clear();
    }

    const workersToShow = selectedWorkerId 
      ? (workers || []).filter(w => w.id === selectedWorkerId)
      : (workers || []);


    let bounds: L.LatLngBounds | null = null;

    workersToShow.forEach((worker, workerIndex) => {
      const workerColor = WORKER_COLORS[workerIndex % WORKER_COLORS.length];
      
      (worker.service_areas || []).forEach((area) => {
        // Skip inactive areas unless specifically shown
        if (!area.is_active && !showInactiveAreas) return;

        

        // Get zip codes for this area
        const areaZipCodes = worker.service_zipcodes
          .filter(zip => zip.service_area_id === area.id)
          .map(zip => zip.zipcode);

        try {
          const coordinates = area.polygon_coordinates;
          
          
          // Check if we have valid polygon coordinates
          if (coordinates && Array.isArray(coordinates) && coordinates.length >= 3) {
            
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

            if (latLngs.length >= 3) {
              const polygon = L.polygon(latLngs, {
                color: workerColor,
                fillColor: workerColor,
                fillOpacity: area.is_active ? 0.3 : 0.1,
                weight: area.is_active ? 2 : 1,
                opacity: area.is_active ? 0.8 : 0.4,
                dashArray: area.is_active ? undefined : '5, 5',
              });

              // Add click handler
              polygon.on('click', () => {
                setSelectedAreaInfo({
                  worker,
                  area,
                  zipCodes: areaZipCodes.sort()
                });
              });

              polygon.addTo(mapRef.current!);
              if (polygonLayersRef.current instanceof Map) {
                polygonLayersRef.current.set(`${worker.id}-${area.id}`, polygon);
              }

              // Add to bounds
              if (!bounds) {
                bounds = polygon.getBounds();
              } else {
                bounds.extend(polygon.getBounds());
              }
            }
          } else if (areaZipCodes.length > 0) {
            // ZIP-only area: fetch actual ZIP coordinates and create markers
            fetchZipCoordinatesAndRender(areaZipCodes, workerColor, area, worker, bounds);
          }
        } catch (error) {
          console.warn('Error processing service area:', error, area);
        }
      });
    });

    // Fit map to bounds if we have polygons
    if (bounds && mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [workers, selectedWorkerId, showInactiveAreas, showZipOverlays]);

  const handleCloseAreaInfo = () => {
    setSelectedAreaInfo(null);
  };

  return (
    <>
      {/* Enhanced ZIP tooltip styles */}
      <style>{`
        .zip-label-tooltip {
          background: rgba(0, 0, 0, 0.85) !important;
          border: 1px solid #333 !important;
          border-radius: 4px !important;
          color: white !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          padding: 4px 8px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
          text-align: center !important;
          line-height: 1.2 !important;
        }
        .zip-label-tooltip:before {
          border-top-color: rgba(0, 0, 0, 0.85) !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: rgba(0, 0, 0, 0.85) !important;
        }
      `}</style>
      
      <div className="relative h-full min-h-[500px]">
        {/* Enhanced Map Controls */}
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg p-2 shadow-lg border">
            <Button
              size="sm"
              variant={showZipOverlays ? "default" : "outline"}
              onClick={() => setShowZipOverlays(!showZipOverlays)}
              className="w-full"
            >
              {showZipOverlays ? 'Hide ZIP Markers' : 'Show ZIP Markers'}
            </Button>
            
            {/* ZIP status indicator */}
            {showZipOverlays && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>ZIP markers active</span>
              </div>
            )}
          </div>
          
          {/* Zoom hint */}
          <div className="bg-blue-50/90 text-blue-700 text-xs px-2 py-1 rounded backdrop-blur-sm border border-blue-200">
            Zoom in to see ZIP labels
          </div>
        </div>

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
                <span className="font-medium">ZIP Codes in this Area ({selectedAreaInfo.zipCodes.length}):</span>
                <div className="text-xs text-muted-foreground mt-1 max-h-32 overflow-y-auto">
                  {selectedAreaInfo.zipCodes.length > 0 
                    ? selectedAreaInfo.zipCodes.join(', ')
                    : 'No ZIP codes assigned to this area'
                  }
                </div>
              </div>
              
              <div>
                <span className="font-medium">Created:</span> {' '}
                <span className="text-muted-foreground">
                  {new Date(selectedAreaInfo.area.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Sync Polygon Button - only show if area has ZIPs but no polygon or polygon exists */}
              {selectedAreaInfo.zipCodes.length >= 3 && (
                <div className="mt-3 pt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncPolygonToZips(selectedAreaInfo.area, selectedAreaInfo.worker)}
                  >
                    Sync Polygon to ZIPs
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Generate polygon boundary from ZIP coordinates
                  </p>
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
    </>
   );
 };