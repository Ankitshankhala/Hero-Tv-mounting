import { supabase } from '@/integrations/supabase/client';

export interface ComprehensiveZipCoordinate {
  zipcode: string;
  latitude: number;
  longitude: number;
  city: string;
  state_abbr: string;
}

export interface ComprehensiveServiceCoverageResult {
  zipcode: string;
  has_coverage: boolean;
  worker_count: number;
  city: string;
  state_abbr: string;
  latitude: number;
  longitude: number;
  data_source: string;
}

export interface ComprehensiveZctaBoundary {
  zcta5ce: string;
  geom_geojson: any;
  land_area: number;
  water_area: number;
  data_source: string;
}

// Cache for ZIP coverage results with TTL
const zipCoverageCache = new Map<string, { data: ComprehensiveServiceCoverageResult; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get comprehensive service coverage for a ZIP code using consolidated data
 */
export const getComprehensiveZipCoverage = async (zipcode: string): Promise<ComprehensiveServiceCoverageResult | null> => {
  try {
    const { data, error } = await supabase.rpc('get_comprehensive_zip_coverage', {
      p_zipcode: zipcode
    });

    if (error) {
      console.error('Error getting comprehensive ZIP coverage:', error);
      return null;
    }

    return data?.[0] || null;
  } catch (error) {
    console.error('Error in getComprehensiveZipCoverage:', error);
    return null;
  }
};

/**
 * Get cached ZIP coverage with automatic cache invalidation
 */
export const getCachedComprehensiveZipCoverage = async (zipcode: string): Promise<ComprehensiveServiceCoverageResult | null> => {
  const now = Date.now();
  const cached = zipCoverageCache.get(zipcode);
  
  if (cached && cached.expires > now) {
    return cached.data;
  }
  
  const result = await getComprehensiveZipCoverage(zipcode);
  if (result) {
    zipCoverageCache.set(zipcode, {
      data: result,
      expires: now + CACHE_TTL
    });
  }
  
  return result;
};

/**
 * Get ZIP coordinates in batch using comprehensive data
 */
export const getComprehensiveBatchZipCoordinates = async (zipcodes: string[]): Promise<ComprehensiveZipCoordinate[]> => {
  if (zipcodes.length === 0) return [];
  
  try {
    const { data, error } = await supabase
      .from('comprehensive_zip_codes')
      .select('zipcode, latitude, longitude, city, state_abbr')
      .in('zipcode', zipcodes)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      console.error('Error getting batch ZIP coordinates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getComprehensiveBatchZipCoordinates:', error);
    return [];
  }
};

/**
 * Get worker ZIP coordinates using comprehensive data
 */
export const getComprehensiveWorkerZipCoordinates = async (workerId: string): Promise<ComprehensiveZipCoordinate[]> => {
  try {
    // First get the worker's service zipcodes
    const { data: workerZips, error: workerError } = await supabase
      .from('worker_service_zipcodes')
      .select('zipcode')
      .eq('worker_id', workerId);

    if (workerError) {
      console.error('Error getting worker ZIP codes:', workerError);
      return [];
    }

    if (!workerZips || workerZips.length === 0) {
      return [];
    }

    const zipcodes = workerZips.map(item => item.zipcode);

    // Then get comprehensive data for those zipcodes
    const { data: zipData, error: zipError } = await supabase
      .from('comprehensive_zip_codes')
      .select('zipcode, latitude, longitude, city, state_abbr')
      .in('zipcode', zipcodes)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (zipError) {
      console.error('Error getting ZIP coordinates:', zipError);
      return [];
    }

    return zipData || [];
  } catch (error) {
    console.error('Error in getComprehensiveWorkerZipCoordinates:', error);
    return [];
  }
};

/**
 * Get ZCTA boundary from comprehensive data
 */
export const getComprehensiveZctaBoundary = async (zctaCode: string): Promise<ComprehensiveZctaBoundary | null> => {
  try {
    const { data, error } = await supabase
      .from('comprehensive_zcta_polygons')
      .select('zcta5ce, geom, land_area, water_area, data_source')
      .eq('zcta5ce', zctaCode)
      .single();

    if (error) {
      console.error('Error getting ZCTA boundary:', error);
      return null;
    }

    if (!data) return null;

    return {
      zcta5ce: data.zcta5ce,
      geom_geojson: data.geom,
      land_area: data.land_area,
      water_area: data.water_area,
      data_source: data.data_source
    };
  } catch (error) {
    console.error('Error in getComprehensiveZctaBoundary:', error);
    return null;
  }
};

/**
 * Clear all ZIP coverage cache
 */
export const clearComprehensiveZipCoverageCache = (): void => {
  zipCoverageCache.clear();
};

/**
 * Health check for comprehensive ZIP data
 */
export const checkComprehensiveZipDataHealth = async (): Promise<any | null> => {
  try {
    const [zipCountResult, zctaCountResult] = await Promise.all([
      supabase.from('comprehensive_zip_codes').select('count', { count: 'exact' }),
      supabase.from('comprehensive_zcta_polygons').select('count', { count: 'exact' })
    ]);

    return {
      zip_codes_count: zipCountResult.count || 0,
      zcta_polygons_count: zctaCountResult.count || 0,
      overall_health: (zipCountResult.count || 0) > 10000 && (zctaCountResult.count || 0) > 1000 ? 'good' : 'needs_data'
    };
  } catch (error) {
    console.error('Error checking comprehensive ZIP data health:', error);
    return null;
  }
};