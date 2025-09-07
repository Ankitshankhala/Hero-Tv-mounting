
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
