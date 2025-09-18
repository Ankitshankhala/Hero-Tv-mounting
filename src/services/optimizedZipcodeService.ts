import { supabase } from "@/integrations/supabase/client";

interface ZipCoordinate {
  zipcode: string;
  latitude: number;
  longitude: number;
  city: string;
  state_abbr: string;
}

interface ServiceCoverageResult {
  has_coverage: boolean;
  worker_count: number;
  city: string;
  state: string;
  state_abbr: string;
  latitude: number | null;
  longitude: number | null;
}

// Comprehensive ZIP coverage lookup using optimized database function
export const getComprehensiveZipCoverage = async (zipcode: string): Promise<ServiceCoverageResult> => {
  try {
    const { data, error } = await supabase.rpc('get_comprehensive_zip_coverage', {
      p_zipcode: zipcode
    });

    if (error) {
      console.error('Error getting comprehensive ZIP coverage:', error);
      return {
        has_coverage: false,
        worker_count: 0,
        city: 'Unknown',
        state: 'Unknown',
        state_abbr: 'US',
        latitude: null,
        longitude: null
      };
    }

    // Map the comprehensive result to the optimized interface
    const result = data[0];
    if (result) {
      return {
        has_coverage: result.has_coverage,
        worker_count: result.worker_count,
        city: result.city,
        state: result.state_abbr, // Map state_abbr to state for backward compatibility
        state_abbr: result.state_abbr,
        latitude: result.latitude,
        longitude: result.longitude
      };
    }
    
    return {
      has_coverage: false,
      worker_count: 0,
      city: 'Unknown',
      state: 'Unknown',
      state_abbr: 'US',
      latitude: null,
      longitude: null
    };
  } catch (error) {
    console.error('Error in getComprehensiveZipCoverage:', error);
    return {
      has_coverage: false,
      worker_count: 0,
      city: 'Unknown',
      state: 'Unknown',
      state_abbr: 'US',
      latitude: null,
      longitude: null
    };
  }
};

// Batch ZIP coordinate lookup
export const getBatchZipCoordinates = async (zipcodes: string[]): Promise<ZipCoordinate[]> => {
  if (zipcodes.length === 0) return [];

  try {
    const { data, error } = await supabase.rpc('get_batch_zip_coordinates', {
      p_zipcodes: zipcodes
    });

    if (error) {
      console.error('Error getting batch ZIP coordinates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getBatchZipCoordinates:', error);
    return [];
  }
};

// Worker ZIP coordinates lookup optimized
export const getWorkerZipCoordinatesBatch = async (workerId: string): Promise<ZipCoordinate[]> => {
  try {
    const { data, error } = await supabase.rpc('get_worker_zip_coordinates_batch', {
      p_worker_id: workerId
    });

    if (error) {
      console.error('Error getting worker ZIP coordinates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getWorkerZipCoordinatesBatch:', error);
    return [];
  }
};

// ZIP data health check
export const checkZipDataHealth = async () => {
  try {
    const { data, error } = await supabase.rpc('check_zip_data_health');

    if (error) {
      console.error('Error checking ZIP data health:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in checkZipDataHealth:', error);
    return null;
  }
};

// Cache with longer TTL for better performance
const zipCoverageCache = new Map<string, { data: ServiceCoverageResult; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

// Cached version of coverage lookup
export const getCachedZipCoverage = async (zipcode: string): Promise<ServiceCoverageResult> => {
  const cleanZip = zipcode.replace(/\D/g, '').slice(0, 5);
  
  // Check cache first
  const cached = zipCoverageCache.get(cleanZip);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  // Fetch fresh data
  const result = await getComprehensiveZipCoverage(cleanZip);
  
  // Cache result
  zipCoverageCache.set(cleanZip, {
    data: result,
    expires: Date.now() + CACHE_TTL
  });

  return result;
};

// Clear cache when needed
export const clearZipCoverageCache = () => {
  zipCoverageCache.clear();
};