import { useState, useCallback } from 'react';
import { getComprehensiveZctaBoundary, type ComprehensiveZctaBoundary } from '@/services/comprehensiveZipcodeService';
import L from 'leaflet';

interface UseComprehensiveZctaBoundariesReturn {
  getZipcodeBoundary: (zipcode: string) => Promise<ComprehensiveZctaBoundary | null>;
  addBoundaryToMap: (map: L.Map, zipcode: string, options?: L.PathOptions) => Promise<L.GeoJSON | null>;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for managing ZCTA boundaries using comprehensive data
 * Replaces client-side GeoJSON loading with database queries
 */
export const useComprehensiveZctaBoundaries = (): UseComprehensiveZctaBoundariesReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getZipcodeBoundary = useCallback(async (zipcode: string): Promise<ComprehensiveZctaBoundary | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
      const boundary = await getComprehensiveZctaBoundary(cleanZipcode);
      
      return boundary;
    } catch (err) {
      console.error('Error getting comprehensive ZCTA boundary:', err);
      setError(err instanceof Error ? err.message : 'Failed to get boundary');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const addBoundaryToMap = useCallback(async (
    map: L.Map, 
    zipcode: string, 
    options: L.PathOptions = {}
  ): Promise<L.GeoJSON | null> => {
    try {
      const boundary = await getZipcodeBoundary(zipcode);
      if (!boundary || !boundary.geom_geojson) {
        console.warn(`No comprehensive boundary found for ZIP code: ${zipcode}`);
        return null;
      }

      const defaultOptions: L.PathOptions = {
        color: '#3b82f6',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        ...options
      };

      const geoJsonLayer = L.geoJSON(boundary.geom_geojson, {
        style: defaultOptions
      }).addTo(map);

      // Fit map to boundary
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }

      return geoJsonLayer;
    } catch (err) {
      console.error('Error adding comprehensive boundary to map:', err);
      setError(err instanceof Error ? err.message : 'Failed to add boundary to map');
      return null;
    }
  }, [getZipcodeBoundary]);

  return {
    getZipcodeBoundary,
    addBoundaryToMap,
    loading,
    error
  };
};