
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
  // Clean zipcode (remove spaces and hyphens, keep only digits)
  const cleanZipcode = zipcode.replace(/[^\d]/g, '');
  
  // Basic format validation - support both 5-digit and 9-digit (ZIP+4) format
  if (!/^\d{5}(\d{4})?$/.test(cleanZipcode)) {
    return null;
  }

  // Use just the first 5 digits for API lookup
  const baseZipcode = cleanZipcode.substring(0, 5);

  // Check cache first
  if (zipcodeCache.has(baseZipcode)) {
    return zipcodeCache.get(baseZipcode) || null;
  }

  try {
    // Use free zipcode API for validation
    const response = await fetch(`https://api.zippopotam.us/us/${baseZipcode}`);
    
    if (!response.ok) {
      zipcodeCache.set(baseZipcode, null);
      return null;
    }

    const data = await response.json();
    
    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      const zipcodeData: ZipcodeData = {
        zipcode: baseZipcode,
        city: place['place name'],
        state: place.state,
        stateAbbr: place['state abbreviation'],
        latitude: parseFloat(place.latitude),
        longitude: parseFloat(place.longitude)
      };
      
      zipcodeCache.set(baseZipcode, zipcodeData);
      return zipcodeData;
    }
    
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

export const isZipcodeInServiceArea = (customerZipcode: string, workerZipcode: string, maxDistance: number = 50): boolean => {
  const distance = calculateZipcodeDistance(customerZipcode, workerZipcode);
  return distance <= maxDistance;
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
