import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ZipBoundary {
  zipcode: string;
  boundary_geojson: any;
  distance_km?: number;
}

export const useZipBoundaries = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getZipcodeBoundary = async (zipcode: string): Promise<any | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: rpcError } = await supabase.rpc('get_zipcode_boundary_geojson', {
        zipcode_param: zipcode
      });
      
      if (rpcError) {
        setError(rpcError.message);
        return null;
      }
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ZIP boundary');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getNearbyZipBoundaries = async (
    lat: number, 
    lng: number, 
    radiusKm: number = 50
  ): Promise<ZipBoundary[]> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: rpcError } = await supabase.rpc('get_nearby_zip_boundaries', {
        center_lat: lat,
        center_lng: lng,
        radius_km: radiusKm
      });
      
      if (rpcError) {
        setError(rpcError.message);
        return [];
      }
      
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch nearby ZIP boundaries');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getServiceAreaZipcodesWithBoundaries = async (
    polygonCoords: any,
    includeBoundaries: boolean = false
  ): Promise<{ zipcode: string; boundary_geojson: any }[]> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: rpcError } = await supabase.rpc('get_service_area_zipcodes_with_boundaries', {
        polygon_coords: polygonCoords,
        include_boundaries: includeBoundaries
      });
      
      if (rpcError) {
        setError(rpcError.message);
        return [];
      }
      
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch service area ZIP codes');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const validatePolygonCoverage = async (polygonCoords: any) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: rpcError } = await supabase.rpc('validate_polygon_coverage', {
        polygon_coords: polygonCoords
      });
      
      if (rpcError) {
        setError(rpcError.message);
        return null;
      }
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate polygon coverage');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getZipcodeBoundary,
    getNearbyZipBoundaries,
    getServiceAreaZipcodesWithBoundaries,
    validatePolygonCoverage
  };
};