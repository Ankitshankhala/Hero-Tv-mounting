import { useState, useCallback } from 'react';
import { validateUSZipcode, getServiceCoverageInfo } from '@/utils/zipcodeValidation';

interface ZipcodeValidationResult {
  isValid: boolean;
  hasServiceCoverage: boolean;
  workerCount: number;
  locationData?: {
    city: string;
    state: string;
    stateAbbr: string;
  };
  isLoading: boolean;
  error?: string;
}

export const useZipcodeValidation = () => {
  const [validationState, setValidationState] = useState<ZipcodeValidationResult>({
    isValid: false,
    hasServiceCoverage: false,
    workerCount: 0,
    isLoading: false
  });

  const validateZipcode = useCallback(async (zipcode: string): Promise<ZipcodeValidationResult> => {
    // Reset state
    setValidationState(prev => ({ ...prev, isLoading: true, error: undefined }));
    
    try {
      // Start both lookups in parallel for better performance
      const locationPromise = validateUSZipcode(zipcode);
      const coveragePromise = getServiceCoverageInfo(zipcode);
      
      // Wait for location data first (more critical)
      const locationData = await locationPromise;
      
      if (!locationData) {
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

      // Get coverage data (non-blocking)
      let hasServiceCoverage = false;
      let workerCount = 0;
      try {
        const coverageData = await coveragePromise;
        hasServiceCoverage = coverageData.hasServiceCoverage;
        workerCount = coverageData.workerCount;
      } catch (serviceError) {
        console.warn('Service area check failed, assuming no coverage:', serviceError);
        hasServiceCoverage = false;
        workerCount = 0;
      }
      
      const result = {
        isValid: true,
        hasServiceCoverage,
        workerCount,
        locationData: {
          city: locationData.city,
          state: locationData.state,
          stateAbbr: locationData.stateAbbr
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