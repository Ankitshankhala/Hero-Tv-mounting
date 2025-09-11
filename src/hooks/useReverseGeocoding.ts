import { useState, useCallback } from 'react';
import { reverseGeocode, extractPostalCode, type Coordinates, type ReverseGeocodeResult } from '@/services/reverseGeocodingService';
import { getServiceCoverageInfo } from '@/utils/zipcodeValidation';

interface UseReverseGeocodingProps {
  onPostalCodeFound?: (postalCode: string) => void;
  onServiceCoverageFound?: (coverage: { hasServiceCoverage: boolean; workerCount: number; postalCode: string }) => void;
}

export const useReverseGeocoding = ({ 
  onPostalCodeFound, 
  onServiceCoverageFound 
}: UseReverseGeocodingProps = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReverseGeocodeResult | null>(null);
  const [postalCode, setPostalCode] = useState<string | null>(null);

  const reverseGeocodeCoordinates = useCallback(async (coordinates: Coordinates) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setPostalCode(null);

    try {
      // Step 1: Reverse geocode to get postal code
      const geocodeResult = await reverseGeocode(coordinates);
      setResult(geocodeResult);

      if (!geocodeResult.success) {
        setError(geocodeResult.error || 'Failed to reverse geocode coordinates');
        return;
      }

      // Step 2: Extract and validate postal code
      const extractedPostalCode = extractPostalCode(geocodeResult);
      
      if (!extractedPostalCode) {
        setError('Could not extract valid ZIP code from address');
        return;
      }

      setPostalCode(extractedPostalCode);
      onPostalCodeFound?.(extractedPostalCode);

      // Step 3: Check service coverage for the postal code
      if (onServiceCoverageFound) {
        try {
          const coverageInfo = await getServiceCoverageInfo(extractedPostalCode);
          onServiceCoverageFound({
            hasServiceCoverage: coverageInfo.hasServiceCoverage,
            workerCount: coverageInfo.workerCount,
            postalCode: extractedPostalCode
          });
        } catch (coverageError) {
          console.warn('Failed to check service coverage:', coverageError);
          // Don't fail the entire operation if coverage check fails
          onServiceCoverageFound({
            hasServiceCoverage: false,
            workerCount: 0,
            postalCode: extractedPostalCode
          });
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Reverse geocoding error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onPostalCodeFound, onServiceCoverageFound]);

  const checkServiceCoverageAtCoordinates = useCallback(async (coordinates: Coordinates) => {
    return new Promise<{ 
      success: boolean; 
      postalCode?: string; 
      hasServiceCoverage?: boolean; 
      workerCount?: number;
      error?: string;
    }>((resolve) => {
      reverseGeocodeCoordinates(coordinates).then(() => {
        if (error) {
          resolve({ success: false, error });
        } else if (postalCode) {
          // This will be populated by the callback, but we need to get it from the latest state
          getServiceCoverageInfo(postalCode).then(coverage => {
            resolve({
              success: true,
              postalCode,
              hasServiceCoverage: coverage.hasServiceCoverage,
              workerCount: coverage.workerCount
            });
          }).catch(coverageError => {
            resolve({
              success: true, // Reverse geocoding succeeded
              postalCode,
              hasServiceCoverage: false,
              workerCount: 0,
              error: `Coverage check failed: ${coverageError.message}`
            });
          });
        } else {
          resolve({ success: false, error: 'No postal code found' });
        }
      });
    });
  }, [reverseGeocodeCoordinates, error, postalCode]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setResult(null);
    setPostalCode(null);
  }, []);

  return {
    reverseGeocodeCoordinates,
    checkServiceCoverageAtCoordinates,
    isLoading,
    error,
    result,
    postalCode,
    reset
  };
};