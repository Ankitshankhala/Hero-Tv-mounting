import { useState, useEffect, useCallback, useRef } from 'react';
import * as L from 'leaflet';
import { unifiedZctaManager, ZctaLoadProgress } from '@/services/unifiedZctaManager';

interface ZctaMapOptions {
  showBoundaries?: boolean;
  boundaryStyle?: L.PathOptions;
  onZipcodesVisible?: (zipcodes: string[]) => void;
  autoUpdate?: boolean;
}

interface ZctaMapState {
  isLoading: boolean;
  progress: ZctaLoadProgress | null;
  error: string | null;
  visibleZipcodes: string[];
  boundaryLayers: Map<string, L.GeoJSON>;
}

export const useZctaMapIntegration = (
  map: L.Map | null,
  options: ZctaMapOptions = {}
) => {
  const {
    showBoundaries = false,
    boundaryStyle = {
      color: '#3b82f6',
      weight: 1,
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      opacity: 0.6
    },
    onZipcodesVisible,
    autoUpdate = true
  } = options;

  const [state, setState] = useState<ZctaMapState>({
    isLoading: false,
    progress: null,
    error: null,
    visibleZipcodes: [],
    boundaryLayers: new Map()
  });

  const boundaryLayersRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const currentBoundsRef = useRef<L.LatLngBounds | null>(null);

  // Initialize ZCTA data loading
  useEffect(() => {
    let progressCleanup: (() => void) | null = null;

    const loadZctaData = async () => {
      if (unifiedZctaManager.isReady()) {
        setState(prev => ({ ...prev, isLoading: false, progress: null }));
        return;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      progressCleanup = unifiedZctaManager.addProgressListener((progress) => {
        setState(prev => ({ ...prev, progress }));
      });

      try {
        await unifiedZctaManager.loadZctaData();
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          progress: null,
          error: null 
        }));
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Failed to load ZCTA data'
        }));
      }
    };

    loadZctaData();

    return () => {
      if (progressCleanup) {
        progressCleanup();
      }
    };
  }, []);

  // Update visible ZIP codes when map bounds change
  const updateVisibleZipcodes = useCallback(() => {
    if (!map || !unifiedZctaManager.isReady()) return;

    const bounds = map.getBounds();
    currentBoundsRef.current = bounds;

    const zipcodes = unifiedZctaManager.findZipcodesInBounds(bounds);
    
    setState(prev => ({ ...prev, visibleZipcodes: zipcodes }));
    onZipcodesVisible?.(zipcodes);
  }, [map, onZipcodesVisible]);

  // Set up map event listeners
  useEffect(() => {
    if (!map || !autoUpdate) return;

    const onMapChange = () => {
      updateVisibleZipcodes();
    };

    map.on('moveend', onMapChange);
    map.on('zoomend', onMapChange);

    // Initial update
    updateVisibleZipcodes();

    return () => {
      map.off('moveend', onMapChange);
      map.off('zoomend', onMapChange);
    };
  }, [map, autoUpdate, updateVisibleZipcodes]);

  // Manage boundary display
  useEffect(() => {
    if (!map || !showBoundaries || !unifiedZctaManager.isReady()) {
      // Remove all boundaries if not showing
      boundaryLayersRef.current.forEach(layer => {
        map?.removeLayer(layer);
      });
      boundaryLayersRef.current.clear();
      return;
    }

    const zoom = map.getZoom();
    const shouldShowBoundaries = zoom >= 11; // Only show at higher zoom levels

    if (!shouldShowBoundaries) {
      // Remove boundaries at low zoom
      boundaryLayersRef.current.forEach(layer => {
        map.removeLayer(layer);
      });
      boundaryLayersRef.current.clear();
      return;
    }

    // Show boundaries for visible ZIP codes
    const maxBoundaries = 50; // Limit for performance
    const zipcodesToShow = state.visibleZipcodes.slice(0, maxBoundaries);

    // Remove boundaries that are no longer visible
    boundaryLayersRef.current.forEach((layer, zipcode) => {
      if (!zipcodesToShow.includes(zipcode)) {
        map.removeLayer(layer);
        boundaryLayersRef.current.delete(zipcode);
      }
    });

    // Add new boundaries
    zipcodesToShow.forEach(zipcode => {
      if (boundaryLayersRef.current.has(zipcode)) return;

      const feature = unifiedZctaManager.getZipcodeBoundary(zipcode);
      if (!feature) return;

      try {
        const layer = L.geoJSON(feature, {
          style: boundaryStyle,
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(`ZIP ${zipcode}`, {
              permanent: false,
              direction: 'center',
              className: 'zcta-tooltip'
            });
          }
        });

        layer.addTo(map);
        boundaryLayersRef.current.set(zipcode, layer);
      } catch (error) {
        console.warn(`Failed to add boundary for ZIP ${zipcode}:`, error);
      }
    });

  }, [map, showBoundaries, state.visibleZipcodes, boundaryStyle]);

  // Manual boundary control functions
  const addZipcodeBoundary = useCallback((zipcode: string, customStyle?: L.PathOptions) => {
    if (!map || !unifiedZctaManager.isReady()) return null;

    const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
    const feature = unifiedZctaManager.getZipcodeBoundary(cleanZipcode);
    
    if (!feature) return null;

    try {
      const layer = L.geoJSON(feature, {
        style: { ...boundaryStyle, ...customStyle },
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(`ZIP ${cleanZipcode}`, {
            permanent: false,
            direction: 'center'
          });
        }
      });

      layer.addTo(map);
      boundaryLayersRef.current.set(cleanZipcode, layer);
      
      return layer;
    } catch (error) {
      console.error(`Failed to add boundary for ZIP ${cleanZipcode}:`, error);
      return null;
    }
  }, [map, boundaryStyle]);

  const removeZipcodeBoundary = useCallback((zipcode: string) => {
    if (!map) return;

    const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
    const layer = boundaryLayersRef.current.get(cleanZipcode);
    
    if (layer) {
      map.removeLayer(layer);
      boundaryLayersRef.current.delete(cleanZipcode);
    }
  }, [map]);

  const removeAllBoundaries = useCallback(() => {
    if (!map) return;

    boundaryLayersRef.current.forEach(layer => {
      map.removeLayer(layer);
    });
    boundaryLayersRef.current.clear();
  }, [map]);

  const fitToBoundary = useCallback((zipcode: string) => {
    if (!map || !unifiedZctaManager.isReady()) return;

    const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
    const feature = unifiedZctaManager.getZipcodeBoundary(cleanZipcode);
    
    if (feature) {
      const tempLayer = L.geoJSON(feature);
      const bounds = tempLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map) {
        boundaryLayersRef.current.forEach(layer => {
          map.removeLayer(layer);
        });
        boundaryLayersRef.current.clear();
      }
    };
  }, [map]);

  return {
    ...state,
    boundaryLayers: boundaryLayersRef.current,
    isReady: unifiedZctaManager.isReady(),
    addZipcodeBoundary,
    removeZipcodeBoundary,
    removeAllBoundaries,
    fitToBoundary,
    updateVisibleZipcodes,
    forceReload: () => unifiedZctaManager.loadZctaData(true)
  };
};