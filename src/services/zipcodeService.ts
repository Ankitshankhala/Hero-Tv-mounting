
import { supabase } from "@/integrations/supabase/client";
import { findLocalZip } from "@/utils/localZipIndex";
import { cleanZip, isValidZip } from "@/utils/zip";

interface ZipcodeData {
  city: string;
  state: string;
  stateAbbr: string;
}

export const lookupZipcode = async (zipcode: string): Promise<ZipcodeData | null> => {
  try {
    const cleanZipcode = cleanZip(zipcode);
    if (!isValidZip(cleanZipcode)) {
      return null;
    }

    // 1) Local in-memory ZIP index (instant, no network, authoritative for
    // common ZIPs — avoids Zippopotam 404 noise for known ZIPs like 78701/10001/90210).
    try {
      const local = await findLocalZip(cleanZipcode);
      if (local) {
        return {
          city: local.city,
          state: local.state,
          stateAbbr: local.stateAbbr,
        };
      }
    } catch (e) {
      console.warn('Local ZIP index lookup failed:', e);
    }

    // 2) us_zip_codes DB table
    const { data: dbData, error: dbError } = await supabase
      .from('us_zip_codes')
      .select('city, state, state_abbr')
      .eq('zipcode', cleanZipcode)
      .single();

    if (!dbError && dbData) {
      return {
        city: dbData.city,
        state: dbData.state,
        stateAbbr: dbData.state_abbr,
      };
    }

    // 3) Zippopotam (ZIP-keyed endpoint, accurate)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`https://api.zippopotam.us/us/${cleanZipcode}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const fallbackData = await response.json();
        if (fallbackData.places && fallbackData.places.length > 0) {
          const place = fallbackData.places[0];
          return {
            city: place['place name'],
            state: place['state'],
            stateAbbr: place['state abbreviation'],
          };
        }
      }
    } catch (fallbackError) {
      console.warn('Zippopotam.us lookup failed:', fallbackError);
    }

    // NOTE: OpenDataSoft fallback removed — it used q=<zip> (full-text
    // search), which returned wrong city/state pairs (e.g. "Austin, SC"
    // for ZIP 78701).

    // Neutral final fallback
    return {
      city: 'Service Area',
      state: 'US',
      stateAbbr: 'US',
    };
  } catch (error) {
    console.error('Error looking up zipcode:', error);
    return {
      city: 'Service Area',
      state: 'US',
      stateAbbr: 'US',
    };
  }
};

// Map city/state combinations to our regions
export const mapToRegion = (city: string, state: string): string => {
  const cityLower = city.toLowerCase();

  if (cityLower.includes('downtown') || cityLower.includes('center')) {
    return 'downtown';
  } else if (cityLower.includes('north')) {
    return 'north-side';
  } else if (cityLower.includes('east')) {
    return 'east-side';
  } else if (cityLower.includes('west')) {
    return 'west-end';
  } else if (cityLower.includes('south')) {
    return 'south-side';
  }

  return 'downtown';
};

// Interface for service area assignment
export interface ServiceAreaAssignment {
  areaId: string;
  areaName: string;
  workerId: string;
  workerName: string;
  isActive: boolean;
}

// Cache for service area assignments with TTL
const serviceAreaCache = new Map<string, { data: ServiceAreaAssignment | null; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-flight request deduplication
const pendingRequests = new Map<string, Promise<ServiceAreaAssignment | null>>();

// Function to get service area assignment for a ZIP code
export const getZipServiceAreaAssignment = async (zipcode: string): Promise<ServiceAreaAssignment | null> => {
  const cleanZipcode = cleanZip(zipcode);

  if (!isValidZip(cleanZipcode)) {
    return null;
  }

  const cached = serviceAreaCache.get(cleanZipcode);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  if (pendingRequests.has(cleanZipcode)) {
    return pendingRequests.get(cleanZipcode)!;
  }

  const request = (async (): Promise<ServiceAreaAssignment | null> => {
    try {
      const { data, error } = await supabase.rpc('get_zip_service_assignment', {
        p_zip: cleanZipcode
      });

      if (error) {
        console.error('Error fetching service area assignment:', error);
        const result = null;
        serviceAreaCache.set(cleanZipcode, { data: result, expires: Date.now() + CACHE_TTL });
        return result;
      }

      if (data && data.length > 0) {
        const assignment: ServiceAreaAssignment = {
          areaId: data[0].area_id,
          areaName: data[0].area_name,
          workerId: data[0].worker_id,
          workerName: data[0].worker_name,
          isActive: data[0].is_active
        };
        serviceAreaCache.set(cleanZipcode, { data: assignment, expires: Date.now() + CACHE_TTL });
        return assignment;
      }

      const result = null;
      serviceAreaCache.set(cleanZipcode, { data: result, expires: Date.now() + CACHE_TTL });
      return result;
    } catch (error) {
      console.error('Error fetching service area assignment:', error);
      const result = null;
      serviceAreaCache.set(cleanZipcode, { data: result, expires: Date.now() + CACHE_TTL });
      return result;
    } finally {
      pendingRequests.delete(cleanZipcode);
    }
  })();

  pendingRequests.set(cleanZipcode, request);

  return request;
};
