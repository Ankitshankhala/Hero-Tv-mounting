
import { useState, useEffect } from 'react';
import { lookupZipcode, mapToRegion } from '@/services/zipcodeService';

interface UseZipcodeSearchProps {
  onLocationFound: (city: string, region: string) => void;
}

export const useZipcodeSearch = ({ onLocationFound }: UseZipcodeSearchProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchZipcode = async (zipcode: string) => {
    // Only search if zipcode is 5 digits
    if (!/^\d{5}$/.test(zipcode)) {
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await lookupZipcode(zipcode);
      
      if (result) {
        const region = mapToRegion(result.city, result.state);
        onLocationFound(result.city, region);
        setError(null);
      } else {
        setError('Zipcode not found');
      }
    } catch (err) {
      setError('Failed to lookup zipcode');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce the search function
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const debouncedSearch = (zipcode: string) => {
    const timeoutId = setTimeout(() => {
      searchZipcode(zipcode);
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  };

  return {
    searchZipcode: debouncedSearch,
    isLoading,
    error
  };
};
