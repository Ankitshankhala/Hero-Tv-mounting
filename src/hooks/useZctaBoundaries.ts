import { useState, useCallback } from 'react';
import L from 'leaflet';

interface ZctaFeature {
  type: 'Feature';
  properties: {
    ZCTA5CE20: string;
    GEOID20: string;
    NAME20: string;
    ALAND20: number;
    AWATER20: number;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

interface UseZctaBoundariesReturn {
  loadZctaBoundaries: () => Promise<GeoJSON.FeatureCollection>;
  getZipcodeBoundary: (zipcode: string) => Promise<ZctaFeature | null>;
  addBoundaryToMap: (map: L.Map, zipcode: string, options?: L.PathOptions) => Promise<L.GeoJSON | null>;
  loading: boolean;
  error: string | null;
}

export const useZctaBoundaries = (): UseZctaBoundariesReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedData, setCachedData] = useState<GeoJSON.FeatureCollection | null>(null);

  const loadZctaBoundaries = useCallback(async (): Promise<GeoJSON.FeatureCollection> => {
    if (cachedData) {
      return cachedData;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/zcta2020_web.geojson');
      if (!response.ok) {
        throw new Error(`Failed to load ZCTA boundaries: ${response.statusText}`);
      }
      
      const data = await response.json() as GeoJSON.FeatureCollection;
      setCachedData(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error loading boundaries';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [cachedData]);

  const getZipcodeBoundary = useCallback(async (zipcode: string): Promise<ZctaFeature | null> => {
    try {
      const data = await loadZctaBoundaries();
      const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
      
      const feature = data.features.find((feature: any) => 
        feature.properties.ZCTA5CE20 === cleanZipcode
      ) as ZctaFeature | undefined;
      
      return feature || null;
    } catch (err) {
      console.error('Error getting zipcode boundary:', err);
      return null;
    }
  }, [loadZctaBoundaries]);

  const addBoundaryToMap = useCallback(async (
    map: L.Map, 
    zipcode: string, 
    options: L.PathOptions = {}
  ): Promise<L.GeoJSON | null> => {
    try {
      const feature = await getZipcodeBoundary(zipcode);
      if (!feature) {
        console.warn(`No boundary found for ZIP code: ${zipcode}`);
        return null;
      }

      const defaultOptions: L.PathOptions = {
        color: '#3b82f6',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        ...options
      };

      const geoJsonLayer = L.geoJSON(feature, {
        style: defaultOptions
      }).addTo(map);

      // Fit map to boundary
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }

      return geoJsonLayer;
    } catch (err) {
      console.error('Error adding boundary to map:', err);
      return null;
    }
  }, [getZipcodeBoundary]);

  return {
    loadZctaBoundaries,
    getZipcodeBoundary,
    addBoundaryToMap,
    loading,
    error
  };
};
