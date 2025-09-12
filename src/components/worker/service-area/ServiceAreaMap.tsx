import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Save, Trash2, Edit3, Search, MapPinCheck, Globe, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWorkerServiceAreas } from '@/hooks/useWorkerServiceAreas';
import { optimizedSupabaseCall } from '@/utils/optimizedApi';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import concaveman from 'concaveman';

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
  onServiceAreaCreated?: () => void;
  isActive?: boolean;
  adminMode?: boolean;
}

const ServiceAreaMap = ({ workerId, onServiceAreaUpdate, onServiceAreaCreated, isActive, adminMode = false }: ServiceAreaMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areaName, setAreaName] = useState('Service Area');
  const [currentPolygon, setCurrentPolygon] = useState<Array<{ lat: number; lng: number }> | null>(null);
  const [drawnPolygon, setDrawnPolygon] = useState<Array<[number, number]> | null>(null);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [testZipcode, setTestZipcode] = useState('');
  const [zipcodeTesting, setZipcodeTesting] = useState(false);
  const [zipcodeTestResult, setZipcodeTestResult] = useState<{ found: boolean; message: string } | null>(null);
  const [showLocationButton, setShowLocationButton] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showZipFallback, setShowZipFallback] = useState(false);
  const [manualZipcodes, setManualZipcodes] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [showZipMarkers, setShowZipMarkers] = useState<boolean>(true);
  const zipMarkersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const [areaSelectionMode, setAreaSelectionMode] = useState<'existing' | 'new'>('new');
  const [selectedExistingArea, setSelectedExistingArea] = useState<ServiceArea | null>(null);
  const [showAreaSelection, setShowAreaSelection] = useState(false);
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

    // Add zoom event listener for dynamic ZIP labels
    map.on('zoomend', () => {
      const currentZoom = map.getZoom();
      
      // Update ZIP marker visibility and labels based on zoom
      zipMarkersRef.current.forEach((marker, zipcode) => {
        const baseRadius = currentZoom > 8 ? 12 : 8;
        marker.setStyle({ radius: baseRadius });
        
        // Toggle permanent labels based on zoom level
        const tooltip = marker.getTooltip();
        if (tooltip) {
          marker.unbindTooltip();
          const content = tooltip.getContent() as string;
          marker.bindTooltip(content, {
            permanent: currentZoom > 11,
            direction: 'top',
            className: 'zip-label-tooltip',
            offset: [0, -8]
          });
        }
      });
    });

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
        
        // Show area selection interface instead of just the name input
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

    // Resize observer to keep map sized correctly
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => map.invalidateSize());
    });
    if (mapContainerRef.current) ro.observe(mapContainerRef.current);

    // Don't auto-detect location in admin mode - let service areas determine bounds
    if (!adminMode) {
      setTimeout(() => {
        autoDetectLocation();
      }, 1000);
    }

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

  // Load existing service areas with optimized caching and ZIP markers
  useEffect(() => {
    if (!workerId) return;
    loadServiceAreas();
    // Remove redundant fetchServiceAreas call
  }, [workerId]);

  // Update ZIP markers when dependencies change
  useEffect(() => {
    if (isActive) {
      renderZipMarkers();
    }
  }, [showZipMarkers, serviceZipcodes, isActive]);

  // Geocode a ZIP code using Zippopotam.us API
  const geocodeZipcode = async (zipcode: string) => {
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

  // Function to generate polygon from ZIP coordinates
  const generatePolygonFromZips = async (zipcodes: string[]) => {
    if (zipcodes.length < 3) {
      toast({
        title: "Need more ZIP codes",
        description: "Need at least 3 ZIP codes to generate a polygon",
        variant: "destructive",
      });
      return null;
    }

    const coordinates = [];
    
    for (const zipcode of zipcodes) {
      try {
        let coords = await getZipCoordinates(zipcode);
        if (!coords) {
          coords = await geocodeZipcode(zipcode);
        }
        if (coords?.latitude && coords?.longitude) {
          coordinates.push(coords);
        }
      } catch (error) {
        console.error(`Error getting coordinates for ZIP ${zipcode}:`, error);
      }
    }

    if (coordinates.length < 3) {
      toast({
        title: "Insufficient coordinates",
        description: "Could not get enough coordinates to generate polygon",
        variant: "destructive",
      });
      return null;
    }

    try {
      const points = coordinates.map(coord => [coord.longitude, coord.latitude]);
      const concavity = points.length > 10 ? 2 : 1.5;
      const hull = concaveman(points, concavity);
      
      // Convert back to lat/lng format for Leaflet
      return hull.map(point => [point[1], point[0]]);
    } catch (error) {
      console.error('Error generating polygon:', error);
      toast({
        title: "Polygon generation failed",
        description: "Failed to generate polygon from ZIP codes",
        variant: "destructive",
      });
      return null;
    }
  };

  // Function to get ZIP coordinates from database
  const getZipCoordinates = async (zipcode: string) => {
    try {
      const { data, error } = await supabase
        .from('us_zip_codes')
        .select('zipcode, latitude, longitude, city')
        .eq('zipcode', zipcode)
        .single();

      if (error || !data) return null;
      return data;
    } catch (error) {
      return null;
    }
  };

  // Enhanced function to render ZIP markers with optional polygon generation
  const renderZipMarkersWithPolygon = async (zipcodes: string[], showPolygon = false) => {
    if (!mapRef.current || !zipcodes.length) return;

    console.log(`Rendering ${zipcodes.length} ZIP markers`);
    
    const coordinates = [];
    
    // Clear existing ZIP markers
    zipMarkersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
    zipMarkersRef.current.clear();
    
    for (const zipcode of zipcodes) {
      try {
        let coords = await getZipCoordinates(zipcode);
        
        if (!coords) {
          // Fallback to geocoding API
          coords = await geocodeZipcode(zipcode);
          if (coords) {
            console.log(`Geocoded ${zipcode}:`, coords);
          }
        }
        
        if (coords?.latitude && coords?.longitude) {
          coordinates.push(coords);
          
          const currentZoom = mapRef.current!.getZoom();
          const baseRadius = currentZoom > 8 ? 12 : 8;
          
          const marker = L.circleMarker([coords.latitude, coords.longitude], {
            radius: baseRadius,
            fillColor: '#10b981',
            color: '#000000', // Dark border for better contrast
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
          });
          
          // Enhanced hover effects
          marker.on('mouseover', () => {
            marker.setStyle({
              radius: baseRadius + 3,
              fillOpacity: 1,
              weight: 3
            });
          });

          marker.on('mouseout', () => {
            marker.setStyle({
              radius: baseRadius,
              fillOpacity: 0.9,
              weight: 2
            });
          });
          
          // Enhanced tooltip with dynamic visibility
          const showPermanentLabel = currentZoom > 11;
          marker.bindTooltip(`${zipcode}<br>${coords.city}`, {
            permanent: showPermanentLabel,
            direction: 'top',
            className: 'zip-label-tooltip',
            offset: [0, -8]
          });

          marker.addTo(mapRef.current!);
          zipMarkersRef.current.set(zipcode, marker);
        }
      } catch (error) {
        console.error(`Error rendering ZIP ${zipcode}:`, error);
      }
    }

    // Generate and show polygon if requested
    if (showPolygon && coordinates.length >= 3) {
      try {
        const points = coordinates.map(coord => [coord.longitude, coord.latitude]);
        const concavity = points.length > 10 ? 2 : 1.5;
        const hull = concaveman(points, concavity);
        const polygonCoords = hull.map(point => [point[1], point[0]]);
        
        const polygon = L.polygon(polygonCoords, {
          color: '#10b981',
          weight: 2,
          opacity: 0.8,
          fillColor: '#10b981',
          fillOpacity: 0.2
        });

        polygon.bindTooltip(`Generated Area<br>ZIP Codes: ${coordinates.length}`, {
          permanent: false,
          direction: 'center'
        });
        
        polygon.addTo(mapRef.current!);
        
        // Store the generated polygon coordinates for potential saving
        setDrawnPolygon(polygonCoords);
        
        // Fit map to show all markers and polygon
        const bounds = L.latLngBounds(coordinates.map(c => [c.latitude, c.longitude]));
        polygonCoords.forEach(coord => bounds.extend(coord));
        mapRef.current.fitBounds(bounds, { padding: [20, 20] });
        
      } catch (error) {
        console.error('Error generating polygon:', error);
        toast({
          title: "Polygon generation failed",
          description: "Failed to generate polygon visualization",
          variant: "destructive",
        });
      }
    } else if (coordinates.length > 0) {
      // Just fit to markers without polygon
      const bounds = L.latLngBounds(coordinates.map(c => [c.latitude, c.longitude]));
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  };

  // Render ZIP code markers for all service areas
  const renderZipMarkers = async () => {
    if (!mapRef.current || !showZipMarkers) {
      // Clear existing markers if hiding
      zipMarkersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
      zipMarkersRef.current.clear();
      return;
    }

    // Clear existing markers
    zipMarkersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
    zipMarkersRef.current.clear();

    // Get all ZIP codes from service areas
    const allZipCodes = serviceZipcodes.map(z => z.zipcode);
    
    if (allZipCodes.length === 0) return;

    await renderZipMarkersWithPolygon(allZipCodes, false);
  };

  const loadServiceAreas = async () => {
    if (!workerId) return;

    setLoading(true);
    try {
      const data = await optimizedSupabaseCall(
        `service-areas-${workerId}`,
        async () => {
          const { data, error } = await supabase
            .from('worker_service_areas')
            .select('id, area_name, polygon_coordinates, is_active, created_at')
            .eq('worker_id', workerId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data;
        },
        true, // use cache
        30000 // 30 second cache
      );

      setServiceAreas(data || []);
      
      // Render ZIP markers when service areas load
      renderZipMarkers();
      
      // Display polygons on map but preserve existing layers if switching quickly
      if (data && data.length > 0 && mapRef.current && drawnItemsRef.current) {
        // Only clear if we're not in middle of loading
        if (!loading) {
          drawnItemsRef.current.clearLayers();
        }
        
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
          } else {
            // Area exists but has no polygon coordinates - likely ZIP-only area
            // Get ZIP codes for this area
            const areaZipCodes = serviceZipcodes.filter(sz => sz.service_area_id === area.id);
            if (areaZipCodes.length > 0) {
              // Create a visual indicator for ZIP-only areas
              const centerLat = 32.7767; // Default Dallas center
              const centerLng = -96.7970;
              
              const zipMarker = L.circleMarker([centerLat, centerLng], {
                color: '#10b981', // Green color for ZIP-only areas
                fillColor: '#10b981',
                fillOpacity: 0.6,
                radius: 6,
                weight: 2
              });

              zipMarker.bindTooltip(`${area.area_name} (${areaZipCodes.length} ZIP codes)`, {
                permanent: false,
                direction: 'top'
              });

              drawnItemsRef.current!.addLayer(zipMarker);
            }
          }
        });
        
        // Fit map to show all polygons or keep default view
        if (hasPolygons && drawnItemsRef.current.getLayers().length > 0) {
          const group = L.featureGroup(drawnItemsRef.current.getLayers());
          mapRef.current.fitBounds(group.getBounds(), { padding: [20, 20] });
        } else if (adminMode) {
          // In admin mode with no polygons, keep the default view without auto-location
          mapRef.current.setView([32.7767, -96.7970], 10);
        } else {
          // For worker mode, keep default view for ZIP-only areas
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

    // Check if area has valid polygon coordinates
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      toast({
        title: "Cannot edit area",
        description: "This area only contains ZIP codes and has no editable polygon.",
        variant: "destructive",
      });
      return;
    }

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
    
    // Show area selection interface for editing
    setShowAreaSelection(true);
    setAreaSelectionMode('existing');
    setSelectedExistingArea(area);
  };

  const handleSaveWithSelection = async () => {
    if (!currentPolygon || currentPolygon.length < 3) {
      toast({
        title: "Error",
        description: "Please draw a polygon with at least 3 points",
        variant: "destructive",
      });
      return;
    }

    if (areaSelectionMode === 'new' && !areaName.trim()) {
      toast({
        title: "Error", 
        description: "Please enter an area name for the new area",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const requestBody: any = {
        workerId: workerId,
        polygon: currentPolygon,
      };

      if (areaSelectionMode === 'existing' && selectedExistingArea) {
        // Add to existing area
        requestBody.areaIdToUpdate = selectedExistingArea.id;
        requestBody.areaName = selectedExistingArea.area_name;
        requestBody.mode = 'append';
      } else {
        // Create new area
        requestBody.areaName = areaName.trim();
        requestBody.mode = 'append';
      }

      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
        body: requestBody
      });

      if (error) throw error;

      if (!data.success) {
        if (data.suggestManualMode) {
          setShowZipFallback(true);
          toast({
            title: "No ZIP codes found",
            description: data.error,
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error || 'Failed to process polygon');
      }

      const zipCountText = data.data?.zipcode_count || data.zipcodesCount || 'some';
      const actionText = areaSelectionMode === 'existing' ? 'added to' : 'created';
      const areaText = areaSelectionMode === 'existing' ? selectedExistingArea?.area_name : areaName;

      toast({
        title: "Success",
        description: `Polygon ${actionText} "${areaText}" with ${zipCountText} ZIP codes`,
      });

      // Clear state
      setCurrentPolygon(null);
      setShowAreaSelection(false);
      setAreaSelectionMode('new');
      setSelectedExistingArea(null);
      setAreaName('Service Area');
      setEditingArea(null);
      
      // Clear map layers
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }

      // Reload service areas
      await loadServiceAreas();
      setShowZipFallback(false);
      
      if (onServiceAreaUpdate) {
        onServiceAreaUpdate();
      }
      if (onServiceAreaCreated) {
        onServiceAreaCreated();
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
      const requestBody: any = {
        workerId: workerId,
        areaName: areaName.trim(),
        polygon: currentPolygon,
        mode: editingArea ? 'append' : 'append'  // For edits, we'll use the areaIdToUpdate
      };

      // If editing an existing area, include the area ID
      if (editingArea) {
        requestBody.areaIdToUpdate = editingArea.id;
      }

      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
        body: requestBody
      });

      if (error) throw error;

      if (!data.success) {
        // Handle the special case where no ZIP codes are found
        if (data.suggestManualMode) {
          setShowZipFallback(true);
          toast({
            title: "No ZIP codes found",
            description: data.error,
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error || 'Failed to process polygon');
      }

      const zipCountText = data.data?.zipcode_count || data.zipcodesCount || 'some';
      const skippedText = data.data?.skipped_count > 0 ? ` (${data.data.skipped_count} duplicates skipped)` : '';
      const actionText = editingArea ? 'updated' : 'saved';

      toast({
        title: "Success",
        description: `Service area ${actionText} with ${zipCountText} ZIP codes${skippedText}`,
      });

      // Clear editing state
      setEditingArea(null);
      setCurrentPolygon(null);
      setAreaName('Service Area');
      
      // Clear map layers
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }

      // Reload service areas
      await loadServiceAreas();
      setShowZipFallback(false);
      
      if (onServiceAreaUpdate) {
        onServiceAreaUpdate();
      }
      if (onServiceAreaCreated) {
        onServiceAreaCreated();
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
    setShowAreaSelection(false);
    setAreaSelectionMode('new');
    setSelectedExistingArea(null);
  };

  const searchForLocation = async () => {
    if (!searchAddress.trim() || !mapRef.current) return;
    
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1&addressdetails=1&countrycodes=us`,
        {
          headers: {
            'User-Agent': 'ServiceAreaMapper/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const location = data[0];
          const lat = parseFloat(location.lat);
          const lng = parseFloat(location.lon);
          
          mapRef.current.setView([lat, lng], 12);
          
          // Add a temporary marker
          const searchMarker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })
          }).addTo(mapRef.current);
          
          searchMarker.bindPopup(`Found: ${location.display_name}`).openPopup();
          setSearchAddress('');
          
          toast({
            title: "Location found",
            description: "Map centered on searched location",
          });
        } else {
          toast({
            title: "Location not found",
            description: "Could not find the specified location",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error searching for location:', error);
      toast({
        title: "Search failed",
        description: "Failed to search for location",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
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
      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
        body: {
          workerId: workerId,
          areaName: areaName.trim() || 'Manual ZIP Codes',
          zipcodesOnly: zipArray,
          mode: 'append'
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

  const suggestZipFromMapCenter = async () => {
    if (!mapRef.current) return;

    try {
      const center = mapRef.current.getCenter();
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}&addressdetails=1&zoom=18`,
        {
          headers: {
            'User-Agent': 'ServiceAreaMapper/1.0'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const zipcode = data.address?.postcode;
        
        if (zipcode && /^\d{5}(-\d{4})?$/.test(zipcode)) {
          const zip5 = zipcode.split('-')[0];
          const currentZips = manualZipcodes.trim();
          const newZips = currentZips ? `${currentZips}, ${zip5}` : zip5;
          setManualZipcodes(newZips);
          
          toast({
            title: "ZIP code suggested",
            description: `Added ${zip5} from map center location`,
          });
        } else {
          toast({
            title: "No ZIP code found",
            description: "Could not determine ZIP code for map center location",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error getting ZIP from map center:', error);
      toast({
        title: "Error",
        description: "Failed to get ZIP code from map center",
        variant: "destructive",
      });
    }
  };

  // Area Selection Interface Component
  const AreaSelectionInterface = () => {
    if (!showAreaSelection || !currentPolygon) return null;
    
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <Label className="font-medium text-blue-800">Choose where to save this area</Label>
            </div>
            
            {/* Existing Areas */}
            {serviceAreas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Add to existing area:</Label>
                {serviceAreas.map(area => (
                  <div
                    key={area.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedExistingArea?.id === area.id
                        ? 'border-blue-500 bg-blue-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedExistingArea(area);
                      setAreaSelectionMode('existing');
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={selectedExistingArea?.id === area.id}
                        onChange={() => {
                          setSelectedExistingArea(area);
                          setAreaSelectionMode('existing');
                        }}
                      />
                      <div>
                        <p className="font-medium">{area.area_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {serviceZipcodes.filter(sz => sz.service_area_id === area.id).length} ZIP codes
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Create New Area Option */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Or create new area:</Label>
              <div
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  areaSelectionMode === 'new'
                    ? 'border-blue-500 bg-blue-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => {
                  setAreaSelectionMode('new');
                  setSelectedExistingArea(null);
                }}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={areaSelectionMode === 'new'}
                    onChange={() => {
                      setAreaSelectionMode('new');
                      setSelectedExistingArea(null);
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium">Create new area</p>
                    <Input
                      placeholder="Enter new area name"
                      value={areaName}
                      onChange={(e) => setAreaName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleSaveWithSelection}
                disabled={saving || (areaSelectionMode === 'new' && !areaName.trim())}
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
                    {areaSelectionMode === 'existing' 
                      ? `Add to ${selectedExistingArea?.area_name}` 
                      : 'Create New Area'
                    }
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAreaSelection(false);
                  setCurrentPolygon(null);
                  if (drawnItemsRef.current) {
                    drawnItemsRef.current.clearLayers();
                  }
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
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
            {/* Search controls */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Search for a location (e.g., 'Dallas, TX' or '123 Main St')"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchForLocation()}
                />
                <Button
                  onClick={searchForLocation}
                  disabled={searching || !searchAddress.trim()}
                  size="sm"
                >
                  {searching ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {showLocationButton && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={centerOnUserLocation}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  My Location
                </Button>
              )}
            </div>

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
             </div>

             {/* ZIP Markers Toggle */}
             <div className="space-y-2">
               <label className="flex items-center space-x-2 text-sm">
                 <input
                   type="checkbox"
                   checked={showZipMarkers}
                   onChange={(e) => setShowZipMarkers(e.target.checked)}
                   className="rounded"
                 />
                 <span>Show ZIP Code Markers</span>
               </label>
               <div className="text-xs text-muted-foreground">
                 Display markers for assigned ZIP codes ({serviceZipcodes.length} total)
               </div>
             </div>

             {/* Area Selection Interface */}
             <AreaSelectionInterface />
             
             {/* Show simple controls when no polygon is drawn and not in area selection mode */}
             {!currentPolygon && !showAreaSelection && (
               <div className="text-center text-muted-foreground py-8">
                 <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                 <p>Draw a polygon on the map to get started</p>
               </div>
             )}

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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="manualZips">ZIP Codes (separated by commas, spaces, or new lines)</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={suggestZipFromMapCenter}
                          disabled={!mapRef.current}
                          className="text-xs"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          Suggest from map center
                        </Button>
                      </div>
                      <Textarea
                        id="manualZips"
                        value={manualZipcodes}
                        onChange={(e) => setManualZipcodes(e.target.value)}
                        placeholder="75201, 75202, 75203..."
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          const zips = manualZipcodes.split(/[,\s\n]+/).map(zip => zip.trim()).filter(Boolean);
                          if (zips.length > 0) {
                            renderZipMarkersWithPolygon(zips, true);
                          } else {
                            toast({
                              title: "No ZIP codes",
                              description: "Please enter some ZIP codes first",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={!manualZipcodes.trim()}
                        variant="outline"
                        className="flex-1"
                      >
                        Preview Polygon
                      </Button>
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
                            Save ZIP Codes Only
                          </>
                        )}
                      </Button>
                    </div>
                    {drawnPolygon && (
                      <Button
                        onClick={() => {
                          // Convert drawn polygon to the format expected by saveServiceArea
                          if (drawnPolygon) {
                            const coordinates = drawnPolygon.map(coord => ({ lat: coord[0], lng: coord[1] }));
                            setCurrentPolygon(coordinates);
                            saveServiceArea();
                          }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Save Generated Polygon
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowZipFallback(false);
                        setDrawnPolygon(null);
                      }}
                    >
                      Cancel
                    </Button>
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
                              {serviceZipcodes.filter(sz => sz.service_area_id === area.id).length} ZIP codes in this area
                            </Badge>
                            {(!area.polygon_coordinates || !Array.isArray(area.polygon_coordinates) || area.polygon_coordinates.length < 3) && (
                              <Badge variant="outline" className="text-xs">
                                ZIP codes only
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {area.polygon_coordinates && Array.isArray(area.polygon_coordinates) && area.polygon_coordinates.length >= 3 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => displayPolygonOnMap(area.polygon_coordinates, area)}
                        title="Edit polygon area"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        title="Cannot edit ZIP-only areas"
                        className="opacity-50 cursor-not-allowed"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
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
    </>
   );
 };

 export default ServiceAreaMap;
