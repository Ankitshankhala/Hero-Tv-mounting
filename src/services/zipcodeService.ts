
import { supabase } from "@/integrations/supabase/client";

interface ZipcodeData {
  city: string;
  state: string;
  stateAbbr: string;
}

export const lookupZipcode = async (zipcode: string): Promise<ZipcodeData | null> => {
  try {
    // Clean zipcode
    const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
    
    // Basic format validation
    if (!/^\d{5}$/.test(cleanZipcode)) {
      return null;
    }
    
    // First try direct database lookup
    const { data: dbData, error: dbError } = await supabase
      .from('us_zip_codes')
      .select('city, state, state_abbr')
      .eq('zipcode', cleanZipcode)
      .single();

    if (!dbError && dbData) {
      console.log('Successfully retrieved zipcode data from database:', dbData);
      return {
        city: dbData.city,
        state: dbData.state,
        stateAbbr: dbData.state_abbr
      };
    }

    console.log('Database lookup failed, trying zippopotam.us with longer timeout');
    
    // Try zippopotam.us with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const response = await fetch(`https://api.zippopotam.us/us/${cleanZipcode}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const fallbackData = await response.json();
        if (fallbackData.places && fallbackData.places.length > 0) {
          const place = fallbackData.places[0];
          console.log('Successfully retrieved zipcode data from zippopotam.us:', place);
          return {
            city: place['place name'],
            state: place['state'],
            stateAbbr: place['state abbreviation']
          };
        }
      }
    } catch (fallbackError) {
      console.error('Zippopotam.us fallback error:', fallbackError);
    }

    // Try OpenDataSoft as final fallback
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      
      const response = await fetch(
        `https://public.opendatasoft.com/api/records/1.0/search/?dataset=us-zip-code-latitude-and-longitude&q=${cleanZipcode}&rows=1`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.records && data.records.length > 0) {
          const record = data.records[0].fields;
          console.log('Successfully retrieved zipcode data from OpenDataSoft:', record);
          return {
            city: record.city,
            state: record.state,
            stateAbbr: record.state
          };
        }
      }
    } catch (openDataError) {
      console.error('OpenDataSoft fallback error:', openDataError);
    }
    
    // Final fallback for valid ZIP codes not found anywhere
    return {
      city: 'Service Area',
      state: 'US',
      stateAbbr: 'US'
    };
    
  } catch (error) {
    console.error('Error looking up zipcode:', error);
    
    // Final fallback
    return {
      city: 'Service Area',
      state: 'US',
      stateAbbr: 'US'
    };
  }
};

// Map city/state combinations to our regions
export const mapToRegion = (city: string, state: string): string => {
  // This is a simple mapping - you can expand this based on your service area
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
  
  // Default to downtown if no pattern matches
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
  const cleanZip = zipcode.replace(/\D/g, '').slice(0, 5);
  
  if (cleanZip.length !== 5) {
    return null;
  }

  // Check cache first with TTL
  const cached = serviceAreaCache.get(cleanZip);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  // Check if request is already in flight
  if (pendingRequests.has(cleanZip)) {
    return pendingRequests.get(cleanZip)!;
  }

  // Create new request
  const request = (async (): Promise<ServiceAreaAssignment | null> => {
    try {
      const { data, error } = await supabase.rpc('get_zip_service_assignment', {
        p_zip: cleanZip
      });

      if (error) {
        console.error('Error fetching service area assignment:', error);
        const result = null;
        serviceAreaCache.set(cleanZip, { data: result, expires: Date.now() + CACHE_TTL });
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
        serviceAreaCache.set(cleanZip, { data: assignment, expires: Date.now() + CACHE_TTL });
        return assignment;
      }

      const result = null;
      serviceAreaCache.set(cleanZip, { data: result, expires: Date.now() + CACHE_TTL });
      return result;
    } catch (error) {
      console.error('Error fetching service area assignment:', error);
      const result = null;
      serviceAreaCache.set(cleanZip, { data: result, expires: Date.now() + CACHE_TTL });
      return result;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(cleanZip);
    }
  })();

  // Store pending request
  pendingRequests.set(cleanZip, request);
  
  return request;
};
