
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
    
    // Use database function to get zipcode location data
    const { data, error } = await supabase.rpc('get_zipcode_location_data', {
      p_zipcode: cleanZipcode
    });
    
    if (error) {
      console.error('Database zipcode lookup error:', error);
      return null;
    }
    
    if (data && data.length > 0) {
      const locationData = data[0];
      return {
        city: locationData.city,
        state: locationData.state,
        stateAbbr: locationData.state
      };
    }
    
    // Try zippopotam.us as fallback for city/state display
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${cleanZipcode}`);
      if (response.ok) {
        const fallbackData = await response.json();
        if (fallbackData.places && fallbackData.places.length > 0) {
          const place = fallbackData.places[0];
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
    
    // Final fallback for valid ZIP codes not found anywhere
    return {
      city: 'Service Area',
      state: 'US',
      stateAbbr: 'US'
    };
    
  } catch (error) {
    console.error('Error looking up zipcode:', error);
    // Try zippopotam.us as fallback even on error
    const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${cleanZipcode}`);
      if (response.ok) {
        const fallbackData = await response.json();
        if (fallbackData.places && fallbackData.places.length > 0) {
          const place = fallbackData.places[0];
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
