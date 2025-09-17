import { useState, useCallback } from 'react';
import { useZipcodeValidationCompat } from './useZctaBookingIntegration';
import { getZctaServiceCoverage, ZctaServiceCoverageData } from '@/utils/zctaServiceCoverage';

interface ZctaBookingValidationResult {
  isValid: boolean;
  hasServiceCoverage: boolean;
  workerCount: number;
  locationData?: {
    city: string;
    state: string;
    stateAbbr: string;
  };
  coverageSource: 'zcta' | 'database' | 'both' | 'none';
  isLoading: boolean;
  error?: string;
  zctaEnhanced: boolean; // Indicates this uses ZCTA data
  workers?: Array<{
    id: string;
    name: string;
    city?: string;
    coverage_source?: string;
  }>;
}

/**
 * Hook for ZCTA-enhanced booking validation that provides backward compatibility
 * with existing zipcode validation while leveraging ZCTA data for better accuracy
 */
export const useZctaBookingValidation = () => {
  const [validationState, setValidationState] = useState<ZctaBookingValidationResult>({
    isValid: false,
    hasServiceCoverage: false,
    workerCount: 0,
    coverageSource: 'none',
    isLoading: false,
    zctaEnhanced: true
  });

  const validateZipcode = useCallback(async (zipcode: string): Promise<ZctaBookingValidationResult> => {
    // Reset state
    setValidationState(prev => ({ ...prev, isLoading: true, error: undefined }));
    
    try {
      // Use ZCTA-enhanced service coverage check
      const coverageData = await getZctaServiceCoverage(zipcode);
      
      // Determine location data from ZCTA or fallback
      let locationData = undefined;
      let isValid = false;
      
      if (coverageData.zctaData && coverageData.zctaData.is_valid) {
        // Use ZCTA location data
        locationData = {
          city: coverageData.zctaData.city,
          state: coverageData.zctaData.state,
          stateAbbr: coverageData.zctaData.state_abbr
        };
        isValid = true;
      } else {
        // Fallback to basic zipcode validation for location data
        const cleanZipcode = zipcode.replace(/[^\d]/g, '');
        if (/^\d{5}(\d{4})?$/.test(cleanZipcode)) {
          isValid = true;
          // We have coverage data but no location data from ZCTA
          // This is still considered valid for booking purposes
        }
      }

      const result: ZctaBookingValidationResult = {
        isValid,
        hasServiceCoverage: coverageData.hasServiceCoverage,
        workerCount: coverageData.workerCount,
        locationData,
        coverageSource: coverageData.coverageSource,
        isLoading: false,
        zctaEnhanced: true,
        workers: []
      };
      
      setValidationState(result);
      return result;
      
    } catch (error) {
      console.error('ZCTA booking validation error:', error);
      const result: ZctaBookingValidationResult = {
        isValid: false,
        hasServiceCoverage: false,
        workerCount: 0,
        coverageSource: 'none',
        isLoading: false,
        error: 'Unable to validate ZIP code',
        zctaEnhanced: true
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

/**
 * Backward compatibility hook that provides the same interface as useZipcodeValidation
 * but uses ZCTA data under the hood
 */
export const useEnhancedZipcodeValidation = () => {
  const zctaValidation = useZctaBookingValidation();
  
  // Map ZCTA result to legacy interface
  return {
    isValid: zctaValidation.isValid,
    hasServiceCoverage: zctaValidation.hasServiceCoverage,
    workerCount: zctaValidation.workerCount,
    locationData: zctaValidation.locationData,
    isLoading: zctaValidation.isLoading,
    error: zctaValidation.error,
    validateZipcode: zctaValidation.validateZipcode,
    // Additional ZCTA-specific data
    coverageSource: zctaValidation.coverageSource,
    zctaEnhanced: zctaValidation.zctaEnhanced
  };
};