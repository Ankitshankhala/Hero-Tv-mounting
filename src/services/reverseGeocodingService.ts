import { supabase } from '@/integrations/supabase/client';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ReverseGeocodeResult {
  success: boolean;
  postal_code?: string;
  formatted_address?: string;
  provider?: string;
  error?: string;
}

// Cache for reverse geocoding results to avoid redundant API calls
const reverseGeocodeCache = new Map<string, { result: ReverseGeocodeResult; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function getCacheKey(lat: number, lng: number): string {
  // Round to 4 decimal places for caching (~11m precision)
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;
  return `${roundedLat},${roundedLng}`;
}

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION;
}

export async function reverseGeocode(coordinates: Coordinates): Promise<ReverseGeocodeResult> {
  const { lat, lng } = coordinates;
  
  // Validate coordinates
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return {
      success: false,
      error: 'Invalid coordinates: lat and lng must be numbers'
    };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      success: false,
      error: 'Invalid coordinates: lat must be -90 to 90, lng must be -180 to 180'
    };
  }

  // Check cache first
  const cacheKey = getCacheKey(lat, lng);
  const cached = reverseGeocodeCache.get(cacheKey);
  
  if (cached && isCacheValid(cached.timestamp)) {
    console.log('Returning cached reverse geocoding result for:', cacheKey);
    return cached.result;
  }

  try {
    console.log('Reverse geocoding coordinates:', lat, lng);
    
    const { data, error } = await supabase.functions.invoke('reverse-geocode', {
      body: { lat, lng }
    });

    if (error) {
      throw new Error(error.message || 'Reverse geocoding function error');
    }

    const result: ReverseGeocodeResult = data;
    
    // Cache the result
    reverseGeocodeCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Clean up old cache entries (simple cleanup strategy)
    if (reverseGeocodeCache.size > 100) {
      const cutoff = Date.now() - CACHE_DURATION;
      for (const [key, entry] of reverseGeocodeCache.entries()) {
        if (entry.timestamp < cutoff) {
          reverseGeocodeCache.delete(key);
        }
      }
    }

    return result;

  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {
      success: false,
      error: `Reverse geocoding failed: ${error.message}`
    };
  }
}

export function extractPostalCode(result: ReverseGeocodeResult): string | null {
  if (!result.success || !result.postal_code) {
    return null;
  }

  // Clean and validate the postal code
  let postalCode = result.postal_code.trim().replace(/\s+/g, '');
  
  // Handle ZIP+4 format (12345-6789 -> 12345)
  if (postalCode.includes('-') && postalCode.length > 5) {
    postalCode = postalCode.split('-')[0];
  }

  // Validate US ZIP code format (5 digits)
  if (!/^\d{5}$/.test(postalCode)) {
    console.warn('Invalid ZIP code format:', postalCode);
    return null;
  }

  return postalCode;
}

export function clearReverseGeocodeCache(): void {
  reverseGeocodeCache.clear();
  console.log('Reverse geocoding cache cleared');
}