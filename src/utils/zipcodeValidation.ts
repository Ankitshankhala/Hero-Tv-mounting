
interface ZipcodeData {
  zipcode: string;
  city: string;
  state: string;
  stateAbbr: string;
  latitude?: number;
  longitude?: number;
}

// Cache for zipcode lookups to avoid repeated API calls
const zipcodeCache = new Map<string, ZipcodeData | null>();

export const validateUSZipcode = async (zipcode: string): Promise<ZipcodeData | null> => {
  // Clean zipcode (remove any non-digits)
  const cleanZipcode = zipcode.replace(/\D/g, '');
  
  // Basic format validation
  if (!/^\d{5}$/.test(cleanZipcode)) {
    return null;
  }

  // Check cache first
  if (zipcodeCache.has(cleanZipcode)) {
    return zipcodeCache.get(cleanZipcode) || null;
  }

  try {
    // Use free zipcode API for validation
    const response = await fetch(`https://api.zippopotam.us/us/${cleanZipcode}`);
    
    if (!response.ok) {
      zipcodeCache.set(cleanZipcode, null);
      return null;
    }

    const data = await response.json();
    
    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      const zipcodeData: ZipcodeData = {
        zipcode: cleanZipcode,
        city: place['place name'],
        state: place.state,
        stateAbbr: place['state abbreviation'],
        latitude: parseFloat(place.latitude),
        longitude: parseFloat(place.longitude)
      };
      
      zipcodeCache.set(cleanZipcode, zipcodeData);
      return zipcodeData;
    }
    
    zipcodeCache.set(cleanZipcode, null);
    return null;
    
  } catch (error) {
    console.error('Zipcode validation error:', error);
    zipcodeCache.set(cleanZipcode, null);
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

export const isZipcodeInServiceArea = (customerZipcode: string, workerZipcode: string, maxDistance: number = 50): boolean => {
  const distance = calculateZipcodeDistance(customerZipcode, workerZipcode);
  return distance <= maxDistance;
};

export const formatZipcode = (value: string): string => {
  // Remove non-digits and limit to 5 characters
  return value.replace(/\D/g, '').substring(0, 5);
};
