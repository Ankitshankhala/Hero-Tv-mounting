import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Save, Trash2, Edit3, Search, MapPinCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWorkerServiceAreas } from '@/hooks/useWorkerServiceAreas';
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
  polygon_coordinates: any; // JSONB from database
  is_active: boolean;
  created_at: string;
}

interface ServiceAreaMapProps {
  workerId: string;
  onServiceAreaUpdate?: () => void;
  isActive?: boolean;
}

const ServiceAreaMap = ({ workerId, onServiceAreaUpdate, isActive }: ServiceAreaMapProps) => {
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
  const [testZipcode, setTestZipcode] = useState('');
  const [zipcodeTesting, setZipcodeTesting] = useState(false);
  const [zipcodeTestResult, setZipcodeTestResult] = useState<{ found: boolean; message: string } | null>(null);
  const [showLocationButton, setShowLocationButton] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showZipFallback, setShowZipFallback] = useState(false);
  const [manualZipcodes, setManualZipcodes] = useState('');
  const { toast } = useToast();
  const { serviceZipcodes, getActiveZipcodes, fetchServiceAreas } = useWorkerServiceAreas(workerId);

  // Initialize map
  useEffect(() => {
    if (!isActive) return;
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map centered on Dallas, TX (will be updated to user's location)
    const map = L.map(mapContainerRef.current).setView([32.7767, -96.7970], 10);
    mapRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create feature group for drawn items
    const drawnItems = new L.FeatureGroup();
    drawnItemsRef.current = drawnItems;
    map.addLayer(drawnItems);

    // Initialize draw control
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: false,
        rectangle: {
          shapeOptions: {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.3
          }
        },
        circle: false,
        marker: false,
        circlemarker: false,
        polygon: {
          allowIntersection: false,
          drawError: {
            color: '#e1e100',
            message: '<strong>Error:</strong> Shape edges cannot cross!'
          },
          shapeOptions: {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.3
          }
        }
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });
    drawControlRef.current = drawControl;
    map.addControl(drawControl);

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

    // Resize observer to keep map sized correctly
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => map.invalidateSize());
    });
    if (mapContainerRef.current) ro.observe(mapContainerRef.current);

    // Auto-detect user location when map is ready
    setTimeout(() => {
      autoDetectLocation();
    }, 1000);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (ro && mapContainerRef.current) ro.unobserve(mapContainerRef.current);
    };
  }, [isActive]);

  // Auto-detect user location when map becomes active
  const autoDetectLocation = async () => {
    if (!mapRef.current || !isActive) return;
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      return;
    }

    // Check permissions first
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'denied') {
          console.log('Geolocation permission denied');
          return;
        }
      }
    } catch (error) {
      console.log('Cannot check geolocation permission');
    }

    setLocationLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 300000 // 5 minutes cache
        });
      });

      const { latitude, longitude } = position.coords;
      mapRef.current.setView([latitude, longitude], 12);
      
      // Add a marker for user's location
      const userMarker = L.marker([latitude, longitude], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(mapRef.current);
      
      userMarker.bindPopup('Your current location').openPopup();
      setShowLocationButton(false);
      
      toast({
        title: "Location detected",
        description: "Map centered on your current location",
      });
    } catch (error) {
      console.log('Auto-location detection failed:', error);
      // Silent fail for auto-detection, keep manual button available
    } finally {
      setLocationLoading(false);
    }
  };

  // Manual location detection (triggered by button)
  const centerOnUserLocation = async () => {
    if (!mapRef.current) return;
    
    setLocationLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes cache
        });
      });

      const { latitude, longitude } = position.coords;
      mapRef.current.setView([latitude, longitude], 12);
      
      // Add a marker for user's location
      const userMarker = L.marker([latitude, longitude], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(mapRef.current);
      
      userMarker.bindPopup('Your current location').openPopup();
      setShowLocationButton(false);
      
      toast({
        title: "Location found",
        description: "Map centered on your current location",
      });
    } catch (error) {
      console.error('Error getting location:', error);
      toast({
        title: "Location access denied",
        description: "Please allow location access or manually navigate to your area",
        variant: "destructive",
      });
    } finally {
      setLocationLoading(false);
    }
  };

  // Ensure map resizes correctly when tab becomes active
  useEffect(() => {
    if (isActive && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 0);
    }
  }, [isActive]);

  // Load existing service areas
  useEffect(() => {
    loadServiceAreas();
    fetchServiceAreas();
  }, [workerId, fetchServiceAreas]);

  const loadServiceAreas = async () => {
    if (!workerId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worker_service_areas')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setServiceAreas(data || []);
      
      // Display all active area polygons on map
      if (data && data.length > 0 && mapRef.current && drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
        
        const activeAreas = data.filter(area => area.is_active);
        let hasPolygons = false;
        
        activeAreas.forEach(area => {
          const coords = area.polygon_coordinates as Array<{ lat: number; lng: number }> | null;
          if (Array.isArray(coords) && coords.length >= 3) {
            hasPolygons = true;
            const latLngs = coords.map(coord => [coord.lat, coord.lng] as [number, number]);
            const polygon = L.polygon(latLngs, {
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.3
            });
            drawnItemsRef.current!.addLayer(polygon);
          }
        });
        
        // Fit map to show all polygons or keep default view
        if (hasPolygons && drawnItemsRef.current.getLayers().length > 0) {
          const group = L.featureGroup(drawnItemsRef.current.getLayers());
          mapRef.current.fitBounds(group.getBounds());
        } else {
          // Handle ZIP-only areas or no areas - keep default view
          mapRef.current.setView([32.7767, -96.7970], 10);
        }
      }
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

  const displayPolygonOnMap = (coordinates: Array<{ lat: number; lng: number }>, area: ServiceArea) => {
    if (!mapRef.current || !drawnItemsRef.current) return;

    // Clear existing polygons
    drawnItemsRef.current.clearLayers();

    // Create polygon
    const latLngs = coordinates.map(coord => [coord.lat, coord.lng] as [number, number]);
    const polygon = L.polygon(latLngs, {
      color: area.is_active ? '#3b82f6' : '#6b7280',
      fillColor: area.is_active ? '#3b82f6' : '#6b7280',
      fillOpacity: 0.3
    });

    drawnItemsRef.current.addLayer(polygon);
    
    // Fit map to polygon bounds
    mapRef.current.fitBounds(polygon.getBounds());
    
    setCurrentPolygon(coordinates);
    setEditingArea(area);
    setAreaName(area.area_name);
  };

  const saveServiceArea = async () => {
    if (!currentPolygon || currentPolygon.length < 3) {
      toast({
        title: "Error",
        description: "Please draw a polygon with at least 3 points",
        variant: "destructive",
      });
      return;
    }

    if (!areaName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an area name",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('polygon-to-zipcodes', {
        body: {
          polygon: currentPolygon,
          workerId: workerId,
          areaName: areaName.trim()
        }
      });

      if (error) throw error;

      if (!data.success) {
        // Handle the special case where no ZIP codes are found
        if (data.error === 'NO_ZIPCODES_FOUND' && data.suggestManualMode) {
          setShowZipFallback(true);
          toast({
            title: "No ZIP codes found",
            description: data.message,
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error || 'Failed to process polygon');
      }

      toast({
        title: "Success",
        description: `Service area saved with ${data.zipcodesCount} zip codes`,
      });

      // Reload service areas
      await loadServiceAreas();
      await fetchServiceAreas();
      setShowZipFallback(false);
      
      if (onServiceAreaUpdate) {
        onServiceAreaUpdate();
      }

    } catch (error) {
      console.error('Error saving service area:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save service area",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteServiceArea = async (areaId: string) => {
    try {
      const { error } = await supabase
        .from('worker_service_areas')
        .delete()
        .eq('id', areaId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service area deleted",
      });

      await loadServiceAreas();
      await fetchServiceAreas();
      
      // Clear map
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }
      setCurrentPolygon(null);
      setEditingArea(null);

      if (onServiceAreaUpdate) {
        onServiceAreaUpdate();
      }

    } catch (error) {
      console.error('Error deleting service area:', error);
      toast({
        title: "Error",
        description: "Failed to delete service area",
        variant: "destructive",
      });
    }
  };

  const clearMap = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
    setCurrentPolygon(null);
    setEditingArea(null);
    setAreaName('Service Area');
    setShowZipFallback(false);
    setManualZipcodes('');
  };

  const saveZipcodesOnly = async () => {
    if (!manualZipcodes.trim()) {
      toast({
        title: "Error",
        description: "Please enter at least one ZIP code",
        variant: "destructive",
      });
      return;
    }

    // Parse and validate ZIP codes
    const zipArray = manualZipcodes
      .split(/[,\s\n]+/)
      .map(zip => zip.trim())
      .filter(zip => /^\d{5}$/.test(zip));

    if (zipArray.length === 0) {
      toast({
        title: "Error",
        description: "Please enter valid 5-digit ZIP codes",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('polygon-to-zipcodes', {
        body: {
          zipcodesOnly: zipArray,
          workerId: workerId,
          areaName: areaName.trim() || 'Manual ZIP Codes'
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to save ZIP codes');
      }

      toast({
        title: "Success",
        description: `Service area saved with ${data.zipcodesCount} ZIP codes`,
      });

      // Reload service areas
      await loadServiceAreas();
      await fetchServiceAreas();
      setShowZipFallback(false);
      setManualZipcodes('');
      
      if (onServiceAreaUpdate) {
        onServiceAreaUpdate();
      }

    } catch (error) {
      console.error('Error saving ZIP codes:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save ZIP codes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testZipcodeInServiceArea = async () => {
    if (!testZipcode.trim()) {
      setZipcodeTestResult({ found: false, message: 'Please enter a ZIP code' });
      return;
    }

    setZipcodeTesting(true);
    setZipcodeTestResult(null);

    try {
      const activeZipcodes = getActiveZipcodes();
      const found = activeZipcodes.includes(testZipcode.trim());
      
      setZipcodeTestResult({
        found,
        message: found 
          ? `✅ ZIP code ${testZipcode} is covered by your service area`
          : `❌ ZIP code ${testZipcode} is not in your service area`
      });
    } catch (error) {
      setZipcodeTestResult({
        found: false,
        message: 'Error testing ZIP code'
      });
    } finally {
      setZipcodeTesting(false);
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Area Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Map container */}
            <div className="relative">
              <div 
                ref={mapContainerRef}
                className="w-full h-96 rounded-lg border"
                style={{ minHeight: '400px' }}
              />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              )}
              {/* Location button overlay */}
              {showLocationButton && (
                <div className="absolute top-4 left-4">
                  <Button
                    onClick={centerOnUserLocation}
                    disabled={locationLoading}
                    variant="secondary"
                    size="sm"
                    className="shadow-lg"
                  >
                    {locationLoading ? (
                      <>
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-b-2 border-primary" />
                        Finding...
                      </>
                    ) : (
                      <>
                        <MapPinCheck className="h-4 w-4 mr-2" />
                        Center on me
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="areaName">Area Name</Label>
                <Input
                  id="areaName"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="Enter area name"
                />
              </div>
              
              <div className="flex items-end gap-2">
                <Button
                  onClick={saveServiceArea}
                  disabled={saving || !currentPolygon}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-b-2 border-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Area
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={clearMap}
                  disabled={!currentPolygon}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* ZIP Code Fallback Mode */}
            {showZipFallback && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-orange-600" />
                      <Label className="font-medium text-orange-800">Manual ZIP Code Entry</Label>
                    </div>
                    <p className="text-sm text-orange-700">
                      No ZIP codes were found in your selected area. You can manually enter the ZIP codes you serve:
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="manualZips">ZIP Codes (separated by commas, spaces, or new lines)</Label>
                      <textarea
                        id="manualZips"
                        value={manualZipcodes}
                        onChange={(e) => setManualZipcodes(e.target.value)}
                        placeholder="75201, 75202, 75203..."
                        className="w-full h-20 p-2 border rounded-md resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={saveZipcodesOnly}
                        disabled={saving || !manualZipcodes.trim()}
                        className="flex-1"
                      >
                        {saving ? (
                          <>
                            <div className="h-4 w-4 mr-2 animate-spin rounded-full border-b-2 border-white" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save ZIP Codes
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowZipFallback(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ZIP Code Tester */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <Label className="font-medium">Test ZIP Code Coverage</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter ZIP code (e.g., 75201)"
                      value={testZipcode}
                      onChange={(e) => setTestZipcode(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && testZipcodeInServiceArea()}
                      className="flex-1"
                    />
                    <Button
                      onClick={testZipcodeInServiceArea}
                      disabled={zipcodeTesting || !getActiveZipcodes().length}
                      variant="outline"
                    >
                      {zipcodeTesting ? 'Testing...' : 'Test'}
                    </Button>
                  </div>
                  {zipcodeTestResult && (
                    <div className={`text-sm p-2 rounded ${
                      zipcodeTestResult.found ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {zipcodeTestResult.message}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">How to use:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Click "Center on me" to find your current location</li>
                <li>Click the polygon tool (rectangle or polygon) on the map</li>
                <li>Draw your service area by clicking points on the map</li>
                <li>Complete the shape by clicking the first point again</li>
                <li>Use the edit tool to modify your polygon</li>
                <li>Enter an area name and click "Save Area"</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing service areas */}
      {serviceAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Service Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serviceAreas.map(area => (
                <div
                  key={area.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    area.is_active ? 'bg-primary/5 border-primary' : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      area.is_active ? 'bg-primary' : 'bg-muted-foreground'
                    }`} />
                    <div>
                      <p className="font-medium">{area.area_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(area.created_at).toLocaleDateString()}
                        {area.is_active && ' • Active'}
                      </p>
                      {area.is_active && (
                        <div className="flex items-center gap-2 mt-1">
                          <MapPinCheck className="h-3 w-3 text-primary" />
                          <Badge variant="secondary" className="text-xs">
                            {getActiveZipcodes().length} ZIP codes covered
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => displayPolygonOnMap(area.polygon_coordinates, area)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteServiceArea(area.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ServiceAreaMap;
