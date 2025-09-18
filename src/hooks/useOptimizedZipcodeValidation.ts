import { useState, useCallback } from 'react';
import { getCachedZipCoverage } from '@/services/optimizedZipcodeService';

interface OptimizedZipcodeValidationResult {
  isValid: boolean;
  hasServiceCoverage: boolean;
  workerCount: number;
  locationData?: {
    city: string;
    state: string;
    stateAbbr: string;
    latitude: number | null;
    longitude: number | null;
  };
  isLoading: boolean;
  error?: string;
}

// Optimized validation hook using comprehensive data and caching
export const useOptimizedZipcodeValidation = () => {
  const [validationState, setValidationState] = useState<OptimizedZipcodeValidationResult>({
    isValid: false,
    hasServiceCoverage: false,
    workerCount: 0,
    isLoading: false
  });

  const validateZipcode = useCallback(async (zipcode: string): Promise<OptimizedZipcodeValidationResult> => {
    // Basic format validation
    const cleanZip = zipcode.replace(/\D/g, '').slice(0, 5);
    if (!/^\d{5}$/.test(cleanZip)) {
      const result = {
        isValid: false,
        hasServiceCoverage: false,
        workerCount: 0,
        isLoading: false,
        error: 'Invalid ZIP code format'
      };
      setValidationState(result);
      return result;
    }

    setValidationState(prev => ({ ...prev, isLoading: true, error: undefined }));
    
    try {
      // Single optimized database call that gets everything
      const coverageData = await getCachedZipCoverage(cleanZip);
      
      const result = {
        isValid: true,
        hasServiceCoverage: coverageData.has_coverage,
        workerCount: coverageData.worker_count,
        locationData: {
          city: coverageData.city,
          state: coverageData.state,
          stateAbbr: coverageData.state_abbr,
          latitude: coverageData.latitude,
          longitude: coverageData.longitude
        },
        isLoading: false
      };
      
      setValidationState(result);
      return result;
      
    } catch (error) {
      console.error('ZIP validation error:', error);
      const result = {
        isValid: false,
        hasServiceCoverage: false,
        workerCount: 0,
        isLoading: false,
        error: 'Unable to validate ZIP code'
      };
      setValidationState(result);
      return result;
    }
  }, []);

  return {
    ...validationState,
    validateZipcode
  };
};