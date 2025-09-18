import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Save, Trash2, Edit3, Search, MapPinCheck, Globe, Loader2, Plus, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminServiceAreas } from '@/hooks/useAdminServiceAreas';
import { PolygonValidator } from './PolygonValidator';
import { useOptimizedZctaService } from '@/hooks/useOptimizedZctaService';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import '@/styles/zipMap.css';

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
  const [polygonValid, setPolygonValid] = useState(true);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [customDrawingMode, setCustomDrawingMode] = useState(false);
  const [customPolygonPoints, setCustomPolygonPoints] = useState<L.LatLng[]>([]);
  const [customPolygonLayer, setCustomPolygonLayer] = useState<L.Polyline | null>(null);
  
  const { toast } = useToast();
  const { 
    createServiceAreaForWorker, 
    updateServiceAreaForWorker, 
    deleteWorkerServiceArea,
    refreshData 
  } = useAdminServiceAreas();
  const zctaService = useOptimizedZctaService();

  // Initialize map with enhanced debugging and proper sizing
  useEffect(() => {
    console.log('🗺️ Map initialization started:', {
      isActive,
      hasExistingMap: !!mapRef.current,
      hasContainer: !!mapContainerRef.current,
      workerId,
      workerName
    });
    
    if (!isActive) {
      console.log('⏸️ Map initialization skipped: not active');
      setMapInitialized(false);
      return;
    }
    if (mapRef.current) {
      console.log('⏸️ Map initialization skipped: map already exists');
      return;
    }
    if (!mapContainerRef.current) {
      console.log('⏸️ Map initialization skipped: no container');
      return;
    }

    // Reset initialization state
    setMapInitialized(false);
    setMapError(null);

    // Ensure container has dimensions before creating map
    const container = mapContainerRef.current;
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      console.log('⏸️ Map container has no dimensions, retrying...');
      setTimeout(() => {
        if (container.offsetWidth > 0 && container.offsetHeight > 0) {
          initializeMap();
        }
      }, 100);
      return;
    }

    initializeMap();

    function initializeMap() {
    console.log('🎯 Creating new Leaflet map...');
      const map = L.map(mapContainerRef.current!, {
        center: [39.8283, -98.5795], // Center of US
        zoom: 4,
        zoomControl: true,
        preferCanvas: false,
        attributionControl: true,
        doubleClickZoom: false, // Disable double-click zoom to prevent conflicts with polygon drawing
        boxZoom: true,
        dragging: true,
        keyboard: true,
        scrollWheelZoom: true,
        touchZoom: true,
        tapTolerance: 15,
        bounceAtZoomLimits: true
      } as L.MapOptions);

      // Add multiple tile layer options for better reliability
      const primaryTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        crossOrigin: true
      });

      // Fallback tile layer
      const fallbackTileLayer = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
        attribution: '© CartoDB',
        maxZoom: 19,
        crossOrigin: true
      });

      let tileLoadAttempts = 0;
      const maxTileLoadAttempts = 3;

      // Add error handling for tile loading with fallback
      primaryTileLayer.on('tileerror', (error) => {
        console.warn('Primary tile loading error:', error);
        tileLoadAttempts++;
        if (tileLoadAttempts >= maxTileLoadAttempts) {
          console.log('Switching to fallback tile layer');
          map.removeLayer(primaryTileLayer);
          fallbackTileLayer.addTo(map);
        }
      });

      let tilesLoaded = false;
      primaryTileLayer.on('tileload', () => {
        if (!tilesLoaded) {
          console.log('Primary tiles loaded successfully');
          tilesLoaded = true;
          setMapInitialized(true);
          setMapError(null);
        }
      });

      fallbackTileLayer.on('tileload', () => {
        if (!tilesLoaded) {
          console.log('Fallback tiles loaded successfully');
          tilesLoaded = true;
          setMapInitialized(true);
          setMapError(null);
        }
      });

      // Set timeout to show error if tiles don't load
      setTimeout(() => {
        if (!tilesLoaded) {
          setMapError('Map tiles failed to load. Please check your internet connection.');
          console.error('Map tiles failed to load after timeout');
        }
      }, 10000);

      primaryTileLayer.addTo(map);

      // Force invalidate size after a short delay
      setTimeout(() => {
        map.invalidateSize();
        console.log('🔄 Map size invalidated');
      }, 100);

    mapRef.current = map;

    // Initialize drawn items layer
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

      // Initialize draw control with minimal configuration to avoid conflicts
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
          polygon: {
            allowIntersection: false,
            showArea: false, // Disable area calculation to prevent the "type is not defined" error
            showLength: false, // Disable length calculation as well
            drawError: {
              color: '#e1e100',
              message: '<strong>Error:</strong> shape edges cannot cross!'
            },
            shapeOptions: {
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.2
            },
            // Additional options to prevent measurement errors
            metric: false,
            feet: false,
            nautic: false
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

      // Safely try to override the polygon drawing handler (may not be available immediately)
      try {
        const drawControlAny = drawControl as any;
        const polygonHandler = drawControlAny?._toolbars?.draw?._modes?.polygon?.handler;
        if (polygonHandler && polygonHandler.completeShape) {
          console.log('🔧 Found polygon handler, applying overrides...');
          
          // Store original methods
          const originalCompleteShape = polygonHandler.completeShape;
          const originalAddVertex = polygonHandler.addVertex;
          
          // Override completeShape to require explicit completion
          if (originalCompleteShape) {
            polygonHandler.completeShape = function() {
              const vertexCount = this._poly ? this._poly.getLatLngs().length : 0;
              console.log('🔒 CompleteShape override called, vertices:', vertexCount);
              if (vertexCount >= 3) {
                originalCompleteShape.call(this);
              } else {
                console.log('⚠️ Not enough vertices to complete shape');
              }
            };
          }
          
          // Override addVertex to track and prevent auto-completion
          if (originalAddVertex) {
            polygonHandler.addVertex = function(latlng) {
              const currentVertices = this._poly ? this._poly.getLatLngs().length : 0;
              console.log('📍 Adding vertex #' + (currentVertices + 1), latlng);
              
              // Call original addVertex
              originalAddVertex.call(this, latlng);
              
              // Prevent auto-completion after 3 vertices
              if (this._poly && this._poly.getLatLngs().length >= 3) {
                // Remove any auto-complete behavior by clearing timeout or flags
                if (this._finishTooltip) {
                  this._finishTooltip = null;
                }
              }
            };
          }
          
          console.log('✅ Polygon handler overrides applied successfully');
        } else {
          console.log('⚠️ Polygon handler not available for override (will try later)');
        }
      } catch (error) {
        console.warn('⚠️ Error accessing polygon handler for override:', error);
      }

      // Comprehensive patch for Leaflet Draw measurement errors
      try {
        // Patch L.GeometryUtil.readableArea if it exists
        if ((L as any).GeometryUtil?.readableArea) {
          const originalReadableArea = (L as any).GeometryUtil.readableArea;
          (L as any).GeometryUtil.readableArea = function(area: number, isMetric?: boolean, type?: string) {
            try {
              // Ensure type parameter is provided
              const measurementType = type || (isMetric !== false ? 'metric' : 'imperial');
              return originalReadableArea.call(this, area, isMetric, measurementType);
            } catch (error) {
              console.warn('Error in GeometryUtil.readableArea, using fallback:', error);
              // Fallback to simple area display
              if (isMetric !== false) {
                return area > 1000000 ? (area / 1000000).toFixed(2) + ' km²' : area.toFixed(0) + ' m²';
              } else {
                const sqft = area * 10.764;
                return sqft > 43560 ? (sqft / 43560).toFixed(2) + ' acres' : sqft.toFixed(0) + ' sq ft';
              }
            }
          };
          console.log('✅ Patched L.GeometryUtil.readableArea function');
        }

        // Also patch the global readableArea function if it exists
        if (typeof (window as any).readableArea !== 'undefined') {
          const originalGlobalReadableArea = (window as any).readableArea;
          (window as any).readableArea = function(area: number, isMetric?: boolean, type?: string) {
            try {
              const measurementType = type || (isMetric !== false ? 'metric' : 'imperial');
              return originalGlobalReadableArea.call(this, area, isMetric, measurementType);
            } catch (error) {
              console.warn('Error in global readableArea, using fallback:', error);
              return area > 1000000 ? (area / 1000000).toFixed(2) + ' km²' : area.toFixed(0) + ' m²';
            }
          };
          console.log('✅ Patched global readableArea function');
        }

        // Patch any readableArea function in the L.Draw namespace
        if ((L as any).Draw?.Polygon?.prototype?._getMeasurementString) {
          const originalGetMeasurementString = (L as any).Draw.Polygon.prototype._getMeasurementString;
          (L as any).Draw.Polygon.prototype._getMeasurementString = function() {
            try {
              return originalGetMeasurementString.call(this);
            } catch (error) {
              console.warn('Error in _getMeasurementString, suppressing:', error);
              return ''; // Return empty string to avoid breaking the drawing
            }
          };
          console.log('✅ Patched L.Draw.Polygon._getMeasurementString');
        }

      } catch (error) {
        console.warn('Could not apply Leaflet Draw patches:', error);
      }

      map.addControl(drawControl);
      drawControlRef.current = drawControl;

      // Wait for draw control to be fully initialized, then apply additional fixes
      setTimeout(() => {
        try {
          const drawControlAny = drawControl as any;
          const polygonDrawer = drawControlAny?._toolbars?.draw?._modes?.polygon?.handler;
          if (polygonDrawer && !polygonDrawer._overridesApplied) {
            console.log('🔧 Applying delayed polygon drawing fixes...');
            
            // Mark as overridden to prevent double application
            polygonDrawer._overridesApplied = true;
            
            // Store original methods if they exist and haven't been overridden yet
            if (polygonDrawer.completeShape && !polygonDrawer._originalCompleteShape) {
              polygonDrawer._originalCompleteShape = polygonDrawer.completeShape;
              polygonDrawer.completeShape = function() {
                const vertexCount = this._poly ? this._poly.getLatLngs().length : 0;
                console.log('🔒 Delayed CompleteShape override called, vertices:', vertexCount);
                
                // Only complete if we have at least 3 vertices and user explicitly wants to complete
                if (vertexCount >= 3) {
                  console.log('✅ Completing polygon with', vertexCount, 'vertices');
                  polygonDrawer._originalCompleteShape.call(this);
                } else {
                  console.log('⚠️ Prevented premature completion with only', vertexCount, 'vertices');
                }
              };
            }

            // Override the finish method to prevent auto-completion
            if (polygonDrawer._finishShape && !polygonDrawer._originalFinishShape) {
              polygonDrawer._originalFinishShape = polygonDrawer._finishShape;
              polygonDrawer._finishShape = function() {
                const vertexCount = this._poly ? this._poly.getLatLngs().length : 0;
                console.log('🏁 Delayed FinishShape override called, vertices:', vertexCount);
                
                if (vertexCount >= 3) {
                  polygonDrawer._originalFinishShape.call(this);
                } else {
                  console.log('⚠️ Prevented finish with insufficient vertices');
                }
              };
            }
            
            console.log('✅ Delayed polygon drawing fixes applied successfully');
          } else if (polygonDrawer?._overridesApplied) {
            console.log('ℹ️ Polygon handler overrides already applied');
          } else {
            console.warn('⚠️ Could not access polygon drawing handler for delayed fixes');
          }
        } catch (error) {
          console.error('❌ Error applying delayed polygon drawing fixes:', error);
        }
      }, 500);

      // Add drawing state tracking
      let drawingInProgress = false;
      let vertexCount = 0;

      // Handle drawing start
      map.on(L.Draw.Event.DRAWSTART, (e: any) => {
        console.log('🎨 Drawing started:', e.layerType);
        drawingInProgress = true;
        vertexCount = 0;
        
        // Show helpful toast for polygon drawing
        if (e.layerType === 'polygon') {
          toast({
            title: "Drawing Polygon",
            description: "Click to add unlimited points. Double-click the last point or click the first point to complete.",
            duration: 6000,
          });
          
          // Disable map double-click zoom during polygon drawing
          map.doubleClickZoom.disable();
          console.log('🚫 Double-click zoom disabled during polygon drawing');
        }
      });

      // Handle vertex addition
      map.on(L.Draw.Event.DRAWVERTEX, (e: any) => {
        vertexCount++;
        console.log('📍 Vertex added:', vertexCount, 'total vertices');
      });

      // Handle drawing stop
      map.on(L.Draw.Event.DRAWSTOP, (e: any) => {
        console.log('🛑 Drawing stopped:', {
          layerType: e.layerType,
          vertexCount,
          reason: 'user_action'
        });
        drawingInProgress = false;
        
        // Re-enable double-click zoom after drawing stops
        if (!map.doubleClickZoom.enabled()) {
          map.doubleClickZoom.enable();
          console.log('✅ Double-click zoom re-enabled after drawing stopped');
        }
      });

      // Handle drawing events with enhanced logging and validation
    map.on(L.Draw.Event.CREATED, (e: any) => {
      console.log('🖊️ Draw event CREATED triggered:', {
        type: e.layerType,
        layer: e.layer,
          vertexCount,
          drawingWasInProgress: drawingInProgress,
        timestamp: new Date().toISOString()
      });
      
      const layer = e.layer;
      drawnItems.addLayer(layer);
      
      if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        const latLngs = layer.getLatLngs();
        const coords = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
        const coordinates = (coords as L.LatLng[]).map((point: L.LatLng) => ({
          lat: point.lat,
          lng: point.lng
        }));
        
        console.log('📍 Polygon coordinates extracted:', {
          pointCount: coordinates.length,
            vertexCountFromTracking: vertexCount,
          firstPoint: coordinates[0],
            lastPoint: coordinates[coordinates.length - 1],
            allPoints: coordinates
          });

          // Validate minimum points
          if (coordinates.length < 3) {
            console.warn('⚠️ Polygon has less than 3 points, removing from map');
            drawnItems.removeLayer(layer);
            toast({
              title: "Invalid Polygon",
              description: "A polygon must have at least 3 points. Please try drawing again.",
              variant: "destructive",
            });
            return;
          }
        
        setCurrentPolygon(coordinates);
        setShowAreaSelection(true);
        
        // Set default selection based on existing areas
        if (serviceAreas.length > 0) {
          const activeAreas = serviceAreas.filter(area => area.is_active);
          if (activeAreas.length > 0) {
            setAreaSelectionMode('existing');
            setSelectedExistingArea(activeAreas[0]);
            console.log('🔄 Set to update existing area:', activeAreas[0].area_name);
          } else {
            setAreaSelectionMode('new');
            setSelectedExistingArea(null);
            console.log('🆕 Set to create new area (no active areas)');
          }
        } else {
          setAreaSelectionMode('new');
          setSelectedExistingArea(null);
          console.log('🆕 Set to create new area (no existing areas)');
        }
      }

        // Reset tracking
        drawingInProgress = false;
        vertexCount = 0;
    });

    map.on(L.Draw.Event.EDITED, (e: any) => {
      console.log('✏️ Draw event EDITED triggered:', e.layers.getLayers().length, 'layers');
      
      const layers = e.layers;
      layers.eachLayer((layer: any) => {
        if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
          const latLngs = layer.getLatLngs();
          const coords = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
          const coordinates = (coords as L.LatLng[]).map((point: L.LatLng) => ({
            lat: point.lat,
            lng: point.lng
          }));
          
          console.log('📍 Updated polygon coordinates:', {
            pointCount: coordinates.length,
            boundingBox: {
              minLat: Math.min(...coordinates.map(p => p.lat)),
              maxLat: Math.max(...coordinates.map(p => p.lat)),
              minLng: Math.min(...coordinates.map(p => p.lng)),
              maxLng: Math.max(...coordinates.map(p => p.lng))
            }
          });
          
          setCurrentPolygon(coordinates);
        }
      });
    });

    map.on(L.Draw.Event.DELETED, () => {
      console.log('🗑️ Draw event DELETED triggered');
      setCurrentPolygon(null);
      setEditingArea(null);
    });

      // Add additional debugging for all map events during drawing
      const debugEvents = ['click', 'dblclick', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
      debugEvents.forEach(eventType => {
        map.on(eventType, (e: any) => {
          if (drawingInProgress) {
            console.log(`🔍 Map ${eventType} during drawing:`, {
              latlng: e.latlng,
              originalEvent: e.originalEvent?.type,
              target: e.target?.constructor?.name,
              vertexCount,
              timestamp: new Date().toISOString()
            });
          }
        });
      });

      // Custom polygon drawing functionality
      let customPoints: L.LatLng[] = [];
      let customPolyline: L.Polyline | null = null;
      let customMarkers: L.CircleMarker[] = [];
      
      const startCustomDrawing = () => {
        console.log('🎨 Starting custom polygon drawing mode');
        setCustomDrawingMode(true);
        customPoints = [];
        customMarkers = [];
        
        // Clear any existing custom drawing
        if (customPolyline) {
          map.removeLayer(customPolyline);
        }
        customMarkers.forEach(marker => map.removeLayer(marker));
        customMarkers = [];
        
        toast({
          title: "Custom Drawing Mode",
          description: "Click to add points. Right-click or press Enter to complete polygon.",
          duration: 8000,
        });
        
        map.getContainer().style.cursor = 'crosshair';
      };
      
      const addCustomPoint = (latlng: L.LatLng) => {
        customPoints.push(latlng);
        console.log('📍 Custom point added:', customPoints.length, latlng);
        
        // Add visual marker
        const marker = L.circleMarker(latlng, {
          radius: 6,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 1
        }).addTo(map);
        customMarkers.push(marker);
        
        // Update polyline
        if (customPolyline) {
          map.removeLayer(customPolyline);
        }
        
        if (customPoints.length > 1) {
          customPolyline = L.polyline(customPoints, {
            color: '#3b82f6',
            weight: 3,
            opacity: 0.8
          }).addTo(map);
        }
        
        // Show completion hint after 3 points
        if (customPoints.length >= 3) {
          toast({
            title: `${customPoints.length} Points Added`,
            description: "Right-click or press Enter to complete the polygon.",
            duration: 3000,
          });
        }
      };
      
      const completeCustomPolygon = () => {
        if (customPoints.length < 3) {
          toast({
            title: "Insufficient Points",
            description: "A polygon needs at least 3 points.",
            variant: "destructive",
          });
          return;
        }
        
        console.log('✅ Completing custom polygon with', customPoints.length, 'points');
        
        // Create the final polygon
        const polygon = L.polygon(customPoints, {
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
          weight: 3
        });
        
        // Clear drawing state
        setCustomDrawingMode(false);
        if (customPolyline) map.removeLayer(customPolyline);
        customMarkers.forEach(marker => map.removeLayer(marker));
        map.getContainer().style.cursor = '';
        
        // Add to drawn items
        drawnItems.addLayer(polygon);
        
        // Convert to coordinates format expected by the rest of the system
        const coordinates = customPoints.map(point => ({
          lat: point.lat,
          lng: point.lng
        }));
        
        setCurrentPolygon(coordinates);
        setShowAreaSelection(true);
        
        // Reset custom drawing state
        customPoints = [];
        customPolyline = null;
        customMarkers = [];
      };
      
      // Add custom drawing event handlers
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (customDrawingMode) {
          e.originalEvent.preventDefault();
          e.originalEvent.stopPropagation();
          addCustomPoint(e.latlng);
        }
      });
      
      map.on('contextmenu', (e: L.LeafletMouseEvent) => {
        if (customDrawingMode) {
          e.originalEvent.preventDefault();
          completeCustomPolygon();
        }
      });
      
      // Keyboard support for custom drawing
      const handleKeyDown = (e: KeyboardEvent) => {
        if (customDrawingMode) {
          if (e.key === 'Enter') {
            e.preventDefault();
            completeCustomPolygon();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setCustomDrawingMode(false);
            if (customPolyline) map.removeLayer(customPolyline);
            customMarkers.forEach(marker => map.removeLayer(marker));
            map.getContainer().style.cursor = '';
            customPoints = [];
            toast({
              title: "Drawing Cancelled",
              description: "Custom polygon drawing cancelled.",
            });
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      
      // Store the custom drawing function for external access
      (map as any)._startCustomDrawing = startCustomDrawing;

      // Add global error handler to catch Leaflet Draw measurement errors
      const originalConsoleError = console.error;
      const handleLeafletDrawErrors = (...args: any[]) => {
        const errorMessage = args.join(' ');
        if (errorMessage.includes('type is not defined') || 
            errorMessage.includes('readableArea') ||
            errorMessage.includes('_getMeasurementString')) {
          console.warn('🔧 Suppressed Leaflet Draw measurement error:', ...args);
          return; // Don't log these specific errors
        }
        originalConsoleError.apply(console, args);
      };
      
      // Temporarily override console.error during drawing
      let errorHandlerActive = false;
      map.on(L.Draw.Event.DRAWSTART, () => {
        if (!errorHandlerActive) {
          console.error = handleLeafletDrawErrors;
          errorHandlerActive = true;
          console.log('🔇 Activated Leaflet Draw error suppression');
        }
      });
      
      map.on(L.Draw.Event.DRAWSTOP, () => {
        if (errorHandlerActive) {
          console.error = originalConsoleError;
          errorHandlerActive = false;
          console.log('🔊 Deactivated Leaflet Draw error suppression');
        }
      });
      
      map.on(L.Draw.Event.CREATED, () => {
        if (errorHandlerActive) {
          console.error = originalConsoleError;
          errorHandlerActive = false;
          console.log('🔊 Deactivated Leaflet Draw error suppression');
        }
      });

    // Resize observer
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => map.invalidateSize());
    });
    if (mapContainerRef.current) ro.observe(mapContainerRef.current);

      return () => {
        // Cleanup event listeners
        document.removeEventListener('keydown', handleKeyDown);
        // Restore original console.error if it was overridden
        if (console.error !== originalConsoleError) {
          console.error = originalConsoleError;
        }
        ro.disconnect();
        map.remove();
      };
    }
  }, [isActive, serviceAreas]);

  // Handle map invalidation when component becomes active/visible
  useEffect(() => {
    if (isActive && mapRef.current) {
      // Delay to ensure container is fully visible
      setTimeout(() => {
        mapRef.current?.invalidateSize();
        console.log('🔄 Map size invalidated due to visibility change');
      }, 200);
    }
  }, [isActive]);

  // Load service areas
  useEffect(() => {
    if (!workerId) return;
    loadServiceAreas();
  }, [workerId]);

  const loadServiceAreas = async () => {
    if (!workerId) {
      console.warn('No workerId provided to loadServiceAreas');
      return;
    }
    
    setLoading(true);
    try {
      console.log(`Loading service areas for worker: ${workerId}`);
      
      const { data, error } = await supabase
        .from('worker_service_areas')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error loading service areas:', error);
        throw error;
      }
      
      console.log(`Loaded ${data?.length || 0} service areas for worker ${workerId}`);
      setServiceAreas(data || []);
    } catch (error) {
      console.error('Error loading service areas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      
      toast({
        title: "Database Error",
        description: `Failed to load service areas: ${errorMessage}`,
        variant: "destructive",
      });
      
      // Set empty array instead of leaving undefined
      setServiceAreas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolygon = async () => {
    if (!currentPolygon || !workerId) {
      console.warn('🚫 Missing required data for saving polygon:', { 
        hasPolygon: !!currentPolygon, 
        workerId,
        areaName 
      });
      toast({
        title: "Validation Error",
        description: "Missing polygon data or worker ID",
        variant: "destructive",
      });
      return;
    }

    console.log('🎨 Starting polygon save operation:', {
      workerId,
      areaName,
      mode: areaSelectionMode,
      selectedArea: selectedExistingArea?.id,
      polygonPoints: currentPolygon.length,
      timestamp: new Date().toISOString()
    });

    setSaving(true);
    
    try {
      // Let the database compute ZIP codes from polygon
      console.log('🗺️ Using database-only ZIP code computation...');

      // Prepare data for edge function
      const saveData = {
        workerId,
        areaName: areaSelectionMode === 'new' ? areaName : selectedExistingArea?.area_name,
        polygon: currentPolygon,
        zipCodes: [], // Let database compute ZIP codes
        mode: areaSelectionMode === 'existing' ? 'update' : 'create',
        ...(areaSelectionMode === 'existing' && selectedExistingArea && {
          areaIdToUpdate: selectedExistingArea.id
        })
      };

      console.log('📡 Calling service-area-upsert edge function with:', saveData);

      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
        body: saveData
      });

      console.log('📡 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(error.message || 'Edge function call failed');
      }

      if (!data?.success) {
        console.error('❌ Save operation failed:', data);
        throw new Error(data?.error || 'Save operation failed');
      }

      console.log('✅ Save successful:', data);

      toast({
        title: "Success",
        description: `${data.message || `${areaSelectionMode === 'existing' ? 'Updated' : 'Created'} service area successfully`}. ZIP codes computed in database.`,
      });

      // Clear current polygon and refresh
      setCurrentPolygon(null);
      setShowAreaSelection(false);
      drawnItemsRef.current?.clearLayers();
      
      console.log('🔄 Refreshing service areas after save');
      await loadServiceAreas();
      onServiceAreaUpdate?.();
      onServiceAreaCreated?.();
      
    } catch (error) {
      console.error('💥 Error saving polygon:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: "Save Failed",
        description: `Failed to save service area: ${errorMessage}`,
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
      // Normalize incoming geometry: Feature | Polygon | MultiPolygon | raw coordinates
      let geometry: any = polygonCoords;
      if (geometry && geometry.type === 'Feature') {
        geometry = geometry.geometry;
      }
      if (!geometry || !geometry.type) {
        // If we only have coordinates array, wrap as Polygon
        if (Array.isArray(geometry)) {
          geometry = { type: 'Polygon', coordinates: [geometry] };
        } else if (polygonCoords && polygonCoords.coordinates) {
          geometry = { type: 'Polygon', coordinates: polygonCoords.coordinates };
        } else {
          throw new Error('Unsupported polygon format');
        }
      }

      // If MultiPolygon, take the first polygon ring for editing
      if (geometry.type === 'MultiPolygon') {
        const firstPoly = geometry.coordinates && geometry.coordinates[0];
        if (!firstPoly) throw new Error('Invalid MultiPolygon geometry');
        geometry = { type: 'Polygon', coordinates: firstPoly };
      }

      // Ensure there is at least one linear ring
      const rings = geometry.coordinates && geometry.coordinates[0];
      if (!rings || !Array.isArray(rings)) {
        throw new Error('Polygon has no exterior ring');
      }

      // Render on map using GeoJSON Feature wrapper
      const feature = { type: 'Feature', properties: {}, geometry } as any;
      const polygonLayer = L.geoJSON(feature, {
        style: {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.8,
          fillColor: '#3b82f6',
          fillOpacity: 0.2
        }
      });

      polygonLayer.addTo(drawnItemsRef.current);
      setEditingArea(area);
      setCurrentPolygon(
        rings.map((coord: [number, number]) => ({ lat: coord[1], lng: coord[0] }))
      );

      // Fit map to polygon
      if (polygonLayer.getBounds().isValid()) {
        mapRef.current.fitBounds(polygonLayer.getBounds(), { padding: [20, 20] });
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
        <CardContent className="p-0 relative">
          <div 
            ref={mapContainerRef}
            className="h-96 w-full rounded-b-lg"
            style={{ 
              minHeight: '400px', 
              height: '400px',
              position: 'relative',
              zIndex: 1
            }}
          />
          
          {/* Loading overlay */}
          {!mapInitialized && !mapError && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <div className="text-center">
                  <p className="font-medium">Loading map...</p>
                  <p className="text-sm">Initializing drawing tools</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Error overlay */}
          {mapError && (
            <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3 text-destructive max-w-md text-center">
                <AlertTriangle className="h-8 w-8" />
                <div>
                  <p className="font-medium">Map Loading Error</p>
                  <p className="text-sm mt-1">{mapError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => {
                      setMapError(null);
                      setMapInitialized(false);
                      // Trigger re-initialization
                      if (mapRef.current) {
                        mapRef.current.remove();
                        mapRef.current = null;
                      }
                    }}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Service Area Dialog */}
      <Dialog open={showAreaSelection && !!currentPolygon} onOpenChange={(open) => {
        if (!open) {
          cancelDrawing();
        }
      }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPinCheck className="h-5 w-5 text-primary" />
              Save Service Area
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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

            {/* Polygon Validation */}
            <PolygonValidator
              polygon={currentPolygon}
              onValidationChange={(isValid, warnings) => {
                setPolygonValid(isValid);
                setValidationWarnings(warnings);
              }}
              
            />

            <div className="flex gap-2">
              <Button
                onClick={handleSavePolygon}
                disabled={saving || !polygonValid || (areaSelectionMode === 'existing' && !selectedExistingArea)}
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
          </div>
        </DialogContent>
      </Dialog>

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
