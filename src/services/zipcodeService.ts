
interface ZippopotamResponse {
  'post code': string;
  country: string;
  'country abbreviation': string;
  places: Array<{
    'place name': string;
    longitude: string;
    state: string;
    'state abbreviation': string;
    latitude: string;
  }>;
}

interface ZipcodeData {
  city: string;
  state: string;
  stateAbbr: string;
}

export const lookupZipcode = async (zipcode: string): Promise<ZipcodeData | null> => {
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zipcode}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data: ZippopotamResponse = await response.json();
    
    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        city: place['place name'],
        state: place.state,
        stateAbbr: place['state abbreviation']
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error looking up zipcode:', error);
    return null;
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
