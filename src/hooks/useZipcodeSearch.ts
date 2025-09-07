
import { useState, useCallback, useRef } from 'react';
import { lookupZipcode, mapToRegion } from '@/services/zipcodeService';
import { deduplicateRequest } from '@/utils/optimizedApi';

interface UseZipcodeSearchProps {
  onLocationFound: (city: string, region: string) => void;
}

export const useZipcodeSearch = ({ onLocationFound }: UseZipcodeSearchProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const searchZipcode = useCallback(async (zipcode: string) => {
    // Only search if zipcode is 5 digits
    if (!/^\d{5}$/.test(zipcode)) {
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await deduplicateRequest(
        `zipcode_search_${zipcode}`,
        () => lookupZipcode(zipcode),
        2000 // 2 second TTL for search deduplication
      );
      
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
  }, [onLocationFound]);

  const debouncedSearch = useCallback((zipcode: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      searchZipcode(zipcode);
    }, 350); // Reduced delay for better UX
  }, [searchZipcode]);

  return {
    searchZipcode: debouncedSearch,
    isLoading,
    error
  };
};
