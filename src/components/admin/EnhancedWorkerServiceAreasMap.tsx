import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/zipMap.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Users, Eye, RefreshCw, Zap } from 'lucide-react';
import { useZipBoundaries } from '@/hooks/useZipBoundaries';
import { supabase } from '@/integrations/supabase/client';

interface Worker {
  id: string;
  name: string;
  email: string;
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

export const EnhancedWorkerServiceAreasMap: React.FC<EnhancedWorkerServiceAreasMapProps> = ({
  workers,
  selectedWorkerId,
  showInactiveAreas,
  showZipBoundaries = true
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [coverageValidation, setCoverageValidation] = useState<any>(null);
  const [zipBoundariesVisible, setZipBoundariesVisible] = useState(showZipBoundaries);
  
  const { 
    getNearbyZipBoundaries, 
    validatePolygonCoverage, 
    getServiceAreaZipcodesWithBoundaries,
    loading 
  } = useZipBoundaries();

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

  // Load ZIP boundaries when enabled
  useEffect(() => {
    if (!mapRef.current || !zipBoundariesVisible) return;

    const loadZipBoundaries = async () => {
      try {
        const center = mapRef.current!.getCenter();
        const boundaries = await getNearbyZipBoundaries(center.lat, center.lng, 75);

        boundaries.forEach(({ zipcode, boundary_geojson }) => {
          if (boundary_geojson && mapRef.current) {
            const polygon = L.geoJSON(boundary_geojson, {
              style: {
                color: '#94a3b8',
                weight: 1,
                opacity: 0.4,
                fillColor: '#e2e8f0',
                fillOpacity: 0.05
              }
            }).addTo(mapRef.current);

            polygon.bindTooltip(`ZIP ${zipcode}`, {
              permanent: false,
              direction: 'center',
              className: 'zip-tooltip'
            });
          }
        });
      } catch (error) {
        console.error('Failed to load ZIP boundaries:', error);
      }
    };

    loadZipBoundaries();
  }, [zipBoundariesVisible, getNearbyZipBoundaries]);

  // Render service areas
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing layers
    mapRef.current.eachLayer(layer => {
      if (layer instanceof L.GeoJSON || layer instanceof L.Polygon || layer instanceof L.CircleMarker) {
        mapRef.current!.removeLayer(layer);
      }
    });

    const filteredWorkers = selectedWorkerId 
      ? workers.filter(worker => worker.id === selectedWorkerId)
      : workers;

    let allBounds: L.LatLngBounds | null = null;

    filteredWorkers.forEach((worker, workerIndex) => {
      const workerColor = WORKER_COLORS[workerIndex % WORKER_COLORS.length];
      
      worker.service_areas.forEach(area => {
        if (!showInactiveAreas && !area.is_active) return;

        if (area.polygon_coordinates && mapRef.current) {
          try {
            const polygon = L.geoJSON(area.polygon_coordinates, {
              style: {
                color: workerColor,
                weight: 3,
                opacity: 0.8,
                fillColor: workerColor,
                fillOpacity: area.is_active ? 0.2 : 0.1,
                dashArray: area.is_active ? undefined : '5, 5'
              }
            }).addTo(mapRef.current);

            polygon.bindPopup(`
              <div class="p-2">
                <h3 class="font-bold">${area.area_name}</h3>
                <p class="text-sm">Worker: ${worker.name}</p>
                <p class="text-sm">Status: ${area.is_active ? 'Active' : 'Inactive'}</p>
                <p class="text-sm">ZIP Codes: ${area.zipcode_list?.length || 0}</p>
              </div>
            `);

            polygon.on('click', async () => {
              setSelectedArea({ ...area, worker });
              
              // Validate polygon coverage
              if (area.polygon_coordinates) {
                const validation = await validatePolygonCoverage(area.polygon_coordinates);
                setCoverageValidation(validation);
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

          } catch (error) {
            console.error('Error rendering polygon for area:', area.area_name, error);
          }
        }
      });
    });

    // Fit map to all service areas
    if (allBounds && allBounds.isValid() && mapRef.current) {
      try {
        mapRef.current.fitBounds(allBounds, { padding: [20, 20] });
      } catch (e) {
        console.warn('Skipping fitBounds due to invalid bounds', e);
      }
    }

  }, [workers, selectedWorkerId, showInactiveAreas, validatePolygonCoverage]);

  const handleSyncPolygonToZips = async (area: any, worker: any) => {
    if (!area.polygon_coordinates) return;

    try {
      const zipcodesWithBoundaries = await getServiceAreaZipcodesWithBoundaries(
        area.polygon_coordinates,
        false
      );

      const zipcodes = zipcodesWithBoundaries.map(item => item.zipcode);

      // Update service area with new ZIP codes
      const { error } = await supabase
        .from('worker_service_areas')
        .update({ 
          zipcode_list: zipcodes,
          updated_at: new Date().toISOString()
        })
        .eq('id', area.id);

      if (error) throw error;

      // Update worker_service_zipcodes table
      await supabase
        .from('worker_service_zipcodes')
        .delete()
        .eq('service_area_id', area.id);

      if (zipcodes.length > 0) {
        const zipInserts = zipcodes.map(zipcode => ({
          worker_id: worker.id,
          service_area_id: area.id,
          zipcode
        }));

        await supabase
          .from('worker_service_zipcodes')
          .insert(zipInserts);
      }

      setSelectedArea({ ...area, zipcode_list: zipcodes });
      
    } catch (error) {
      console.error('Failed to sync polygon to ZIP codes:', error);
    }
  };

  return (
    <div className="relative h-full flex">
      <div className="flex-1">
        <div ref={mapContainerRef} className="w-full h-full" />
        
        {loading && (
          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg border">
            <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
            Loading ZIP boundaries...
          </div>
        )}

        <div className="absolute top-4 left-4 space-y-2">
          <Button
            variant={zipBoundariesVisible ? "default" : "outline"}
            size="sm"
            onClick={() => setZipBoundariesVisible(!zipBoundariesVisible)}
          >
            <Eye className="h-4 w-4 mr-2" />
            ZIP Boundaries
          </Button>
        </div>
      </div>

      {selectedArea && (
        <Card className="w-80 m-4 bg-background/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {selectedArea.area_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Worker</p>
              <p className="text-sm text-muted-foreground">{selectedArea.worker.name}</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={selectedArea.is_active ? "default" : "secondary"}>
                {selectedArea.is_active ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {selectedArea.zipcode_list?.length || 0} ZIPs
              </Badge>
            </div>

            {coverageValidation && (
              <div className="space-y-2">
                <Separator />
                <div>
                  <p className="text-sm font-medium">Coverage Analysis</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>ZIP Codes: {coverageValidation.total_zipcodes}</p>
                    <p>Area: {coverageValidation.polygon_area_sq_km} km²</p>
                    <p>Coverage: {coverageValidation.coverage_percentage}%</p>
                  </div>
                </div>
              </div>
            )}

            {selectedArea.zipcode_list?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">ZIP Codes</p>
                <ScrollArea className="h-20">
                  <div className="flex flex-wrap gap-1">
                    {selectedArea.zipcode_list.map((zip: string) => (
                      <Badge key={zip} variant="outline" className="text-xs">
                        {zip}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="space-y-2">
              <Button
                onClick={() => handleSyncPolygonToZips(selectedArea, selectedArea.worker)}
                className="w-full"
                size="sm"
              >
                <Zap className="h-4 w-4 mr-2" />
                Sync Polygon to ZIPs
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setSelectedArea(null)}
                className="w-full"
                size="sm"
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};