import { useState } from 'react';
import { getCachedComprehensiveZipCoverage, type ComprehensiveServiceCoverageResult } from '@/services/comprehensiveZipcodeService';

export interface ComprehensiveZipcodeValidationResult {
  isValid: boolean;
  hasCoverage: boolean;
  workerCount: number;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  dataSource?: string;
  loading: boolean;
  error?: string;
}

export const useComprehensiveZipcodeValidation = () => {
  const [result, setResult] = useState<ComprehensiveZipcodeValidationResult>({
    isValid: false,
    hasCoverage: false,
    workerCount: 0,
    loading: false
  });

  const validateZipcode = async (zipcode: string): Promise<ComprehensiveZipcodeValidationResult> => {
    // Basic validation
    const cleanZipcode = zipcode.replace(/\D/g, '');
    if (cleanZipcode.length !== 5) {
      const invalidResult = {
        isValid: false,
        hasCoverage: false,
        workerCount: 0,
        loading: false,
        error: 'Invalid ZIP code format'
      };
      setResult(invalidResult);
      return invalidResult;
    }

    setResult(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      const coverage = await getCachedComprehensiveZipCoverage(cleanZipcode);
      
      if (!coverage) {
        const notFoundResult = {
          isValid: false,
          hasCoverage: false,
          workerCount: 0,
          loading: false,
          error: 'ZIP code not found'
        };
        setResult(notFoundResult);
        return notFoundResult;
      }

      const validResult = {
        isValid: true,
        hasCoverage: coverage.has_coverage,
        workerCount: coverage.worker_count,
        city: coverage.city,
        state: coverage.state_abbr,
        latitude: coverage.latitude,
        longitude: coverage.longitude,
        dataSource: coverage.data_source,
        loading: false
      };

      setResult(validResult);
      return validResult;
    } catch (error) {
      const errorResult = {
        isValid: false,
        hasCoverage: false,
        workerCount: 0,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to validate ZIP code'
      };
      setResult(errorResult);
      return errorResult;
    }
  };

  return {
    result,
    validateZipcode
  };
};