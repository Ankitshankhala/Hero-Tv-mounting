
import { supabase } from "@/integrations/supabase/client";

interface ZipcodeData {
  zipcode: string;
  city: string;
  state: string;
  stateAbbr: string;
  latitude?: number;
  longitude?: number;
}

import { fetchWithTimeout, raceWithFallback } from './networkUtils';
import { optimizedSupabaseCall } from './optimizedApi';

// Direct database lookup using us_zip_codes table
const fetchZipcodeFromDatabase = async (zipcode: string): Promise<ZipcodeData | null> => {
  try {
    const { data, error } = await supabase
      .from('us_zip_codes')
      .select('zipcode, city, state, state_abbr, latitude, longitude')
      .eq('zipcode', zipcode)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      zipcode: data.zipcode,
      city: data.city,
      state: data.state,
      stateAbbr: data.state_abbr,
      latitude: data.latitude ? parseFloat(data.latitude.toString()) : undefined,
      longitude: data.longitude ? parseFloat(data.longitude.toString()) : undefined
    };
  } catch (error) {
    console.warn('Database zipcode lookup failed:', error);
    return null;
  }
};

// Optimized zipcode lookup using zippopotam.us API with increased timeout
const fetchZipcodeFromZippopotam = async (zipcode: string): Promise<ZipcodeData | null> => {
  try {
    // First attempt with 4 second timeout
    const response = await fetchWithTimeout(`https://api.zippopotam.us/us/${zipcode}`, 4000);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        zipcode: zipcode,
        city: place['place name'],
        state: place['state'],
        stateAbbr: place['state abbreviation'],
        latitude: parseFloat(place.latitude),
        longitude: parseFloat(place.longitude)
      };
    }
    return null;
  } catch (error) {
    // Retry with 6 second timeout if first attempt fails
    try {
      const response = await fetchWithTimeout(`https://api.zippopotam.us/us/${zipcode}`, 6000);
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        return {
          zipcode: zipcode,
          city: place['place name'],
          state: place['state'],
          stateAbbr: place['state abbreviation'],
          latitude: parseFloat(place.latitude),
          longitude: parseFloat(place.longitude)
        };
      }
    } catch (retryError) {
      console.warn('Zippopotam.us API retry failed:', retryError);
    }
    
    return null;
  }
};

// OpenDataSoft API fallback
const fetchZipcodeFromOpenData = async (zipcode: string): Promise<ZipcodeData | null> => {
  try {
    const response = await fetchWithTimeout(
      `https://public.opendatasoft.com/api/records/1.0/search/?dataset=us-zip-code-latitude-and-longitude&q=${zipcode}&rows=1`,
      2500
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    if (data.records && data.records.length > 0) {
      const record = data.records[0].fields;
      return {
        zipcode: zipcode,
        city: record.city,
        state: record.state,
        stateAbbr: record.state,
        latitude: record.latitude,
        longitude: record.longitude
      };
    }
    return null;
  } catch (error) {
    console.warn('OpenDataSoft API failed:', error);
    return null;
  }
};

interface ServiceCoverageData {
  hasServiceCoverage: boolean;
  workerCount: number;
}

// Cache for zipcode lookups to avoid repeated API calls
const zipcodeCache = new Map<string, ZipcodeData | null>();
const serviceCoverageCache = new Map<string, ServiceCoverageData>();

export const validateUSZipcode = async (zipcode: string): Promise<ZipcodeData | null> => {
  // Clean zipcode (remove spaces and hyphens, keep only digits)
  const cleanZipcode = zipcode.replace(/[^\d]/g, '');
  
  // Basic format validation - support both 5-digit and 9-digit (ZIP+4) format
  if (!/^\d{5}(\d{4})?$/.test(cleanZipcode)) {
    return null;
  }

  // Use just the first 5 digits for lookup
  const baseZipcode = cleanZipcode.substring(0, 5);

  // Check cache first
  if (zipcodeCache.has(baseZipcode)) {
    return zipcodeCache.get(baseZipcode) || null;
  }

  try {
    // Use multiple data sources in parallel for better reliability
    const dbPromise = fetchZipcodeFromDatabase(baseZipcode);
    const zippopotamPromise = fetchZipcodeFromZippopotam(baseZipcode);
    const openDataPromise = fetchZipcodeFromOpenData(baseZipcode);

    // Use raceWithFallback to get the first successful result, preferring database
    const result = await raceWithFallback([
      dbPromise,
      zippopotamPromise,
      openDataPromise
    ], 0); // Prefer database result (index 0)

    if (result) {
      zipcodeCache.set(baseZipcode, result);
      return result;
    }
    
    // If no data found anywhere, return null
    zipcodeCache.set(baseZipcode, null);
    return null;
    
  } catch (error) {
    console.error('Zipcode validation error:', error);
    zipcodeCache.set(baseZipcode, null);
    return null;
  }
};

export const calculateZipcodeDistance = (zipcode1: string, zipcode2: string): number => {
  // Simple distance calculation based on zipcode prefixes
  // More accurate distance would require lat/lng coordinates
  const prefix1 = zipcode1.substring(0, 3);
  const prefix2 = zipcode2.substring(0, 3);
  
  if (prefix1 === prefix2) {
    return 0; // Same area
  }
  
  const num1 = parseInt(prefix1);
  const num2 = parseInt(prefix2);
  
  // Rough distance approximation (not geographically accurate)
  return Math.abs(num1 - num2) * 10; // miles approximation
};

// Service area coverage check with worker count
export const getServiceCoverageInfo = async (customerZipcode: string): Promise<ServiceCoverageData> => {
  try {
    // Clean zipcode
    const cleanZipcode = customerZipcode.replace(/[^\d]/g, '').substring(0, 5);
    
    // Check cache first
    if (serviceCoverageCache.has(cleanZipcode)) {
      return serviceCoverageCache.get(cleanZipcode)!;
    }
    
    // Get both coverage and worker count in parallel
    const [coverageResult, workerCountResult] = await Promise.all([
      supabase.rpc('zip_has_active_coverage_by_zip', {
        p_zipcode: cleanZipcode
      }),
      supabase.rpc('get_worker_count_by_zip', {
        p_zipcode: cleanZipcode
      })
    ]);

    if (coverageResult.error) {
      console.error('Service coverage check error:', coverageResult.error);
    }
    
    if (workerCountResult.error) {
      console.error('Worker count check error:', workerCountResult.error);
    }

    const coverageData: ServiceCoverageData = {
      hasServiceCoverage: Boolean(coverageResult.data),
      workerCount: workerCountResult.data || 0
    };
    
    // Cache the result
    serviceCoverageCache.set(cleanZipcode, coverageData);
    return coverageData;
    
  } catch (error) {
    console.error('Error checking service coverage:', error);
    return {
      hasServiceCoverage: false,
      workerCount: 0
    };
  }
};

// Legacy function for backward compatibility
export const isZipcodeInServiceArea = async (customerZipcode: string): Promise<boolean> => {
  const coverage = await getServiceCoverageInfo(customerZipcode);
  return coverage.hasServiceCoverage;
};

export const formatZipcode = (value: string): string => {
  // Remove non-digits 
  const digits = value.replace(/\D/g, '');
  
  // Support ZIP+4 format (12345-6789)
  if (digits.length > 5) {
    const zip5 = digits.substring(0, 5);
    const zip4 = digits.substring(5, 9);
    return zip4 ? `${zip5}-${zip4}` : zip5;
  }
  
  return digits.substring(0, 5);
};

// Cache management utilities
export const clearZipcodeCache = () => {
  zipcodeCache.clear();
  serviceCoverageCache.clear();
};

export const clearZipcodeFromCache = (zipcode: string) => {
  const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
  zipcodeCache.delete(cleanZipcode);
  serviceCoverageCache.delete(cleanZipcode);
};
