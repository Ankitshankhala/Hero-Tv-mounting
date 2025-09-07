import { useState, useCallback } from 'react';
import { validateUSZipcode, isZipcodeInServiceArea } from '@/utils/zipcodeValidation';

interface ZipcodeValidationResult {
  isValid: boolean;
  hasServiceCoverage: boolean;
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
    isLoading: false
  });

  const validateZipcode = useCallback(async (zipcode: string): Promise<ZipcodeValidationResult> => {
    // Reset state
    setValidationState(prev => ({ ...prev, isLoading: true, error: undefined }));
    
    try {
      // First check basic format and get location data
      const locationData = await validateUSZipcode(zipcode);
      
      if (!locationData) {
        const result = {
          isValid: false,
          hasServiceCoverage: false,
          isLoading: false,
          error: 'Invalid ZIP code format'
        };
        setValidationState(result);
        return result;
      }

      // Check service coverage - don't fail if RPC is down
      let hasServiceCoverage = false;
      try {
        hasServiceCoverage = await isZipcodeInServiceArea(zipcode);
      } catch (serviceError) {
        console.warn('Service area check failed, assuming no coverage:', serviceError);
        hasServiceCoverage = false;
      }
      
      const result = {
        isValid: true,
        hasServiceCoverage,
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