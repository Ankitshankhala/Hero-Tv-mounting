import { useState, useCallback } from 'react';
import { type Coordinates } from '@/services/reverseGeocodingService';
import { useReverseGeocoding } from './useReverseGeocoding';

interface ServiceCoverageResult {
  success: boolean;
  coordinates: Coordinates;
  postalCode?: string;
  hasServiceCoverage: boolean;
  workerCount: number;
  formattedAddress?: string;
  provider?: string;
  error?: string;
}

export const useCoordinateServiceCheck = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ServiceCoverageResult[]>([]);
  const [currentResult, setCurrentResult] = useState<ServiceCoverageResult | null>(null);

  const { 
    reverseGeocodeCoordinates, 
    checkServiceCoverageAtCoordinates,
    isLoading: reverseGeocodeLoading,
    error: reverseGeocodeError,
    result: reverseGeocodeResult 
  } = useReverseGeocoding();

  const checkServiceAtCoordinates = useCallback(async (coordinates: Coordinates): Promise<ServiceCoverageResult> => {
    setIsLoading(true);
    
    try {
      const coverage = await checkServiceCoverageAtCoordinates(coordinates);
      
      const result: ServiceCoverageResult = {
        success: coverage.success,
        coordinates,
        postalCode: coverage.postalCode,
        hasServiceCoverage: coverage.hasServiceCoverage || false,
        workerCount: coverage.workerCount || 0,
        formattedAddress: reverseGeocodeResult?.formatted_address,
        provider: reverseGeocodeResult?.provider,
        error: coverage.error
      };

      setCurrentResult(result);
      setResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
      
      return result;

    } catch (error) {
      const errorResult: ServiceCoverageResult = {
        success: false,
        coordinates,
        hasServiceCoverage: false,
        workerCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      setCurrentResult(errorResult);
      setResults(prev => [errorResult, ...prev.slice(0, 9)]);
      
      return errorResult;

    } finally {
      setIsLoading(false);
    }
  }, [checkServiceCoverageAtCoordinates, reverseGeocodeResult]);

  const checkMultipleCoordinates = useCallback(async (coordinatesList: Coordinates[]): Promise<ServiceCoverageResult[]> => {
    setIsLoading(true);
    
    try {
      const results = await Promise.all(
        coordinatesList.map(coords => checkServiceAtCoordinates(coords))
      );
      
      setResults(prev => [...results, ...prev].slice(0, 50)); // Keep last 50 results
      return results;

    } finally {
      setIsLoading(false);
    }
  }, [checkServiceAtCoordinates]);

  const clearResults = useCallback(() => {
    setResults([]);
    setCurrentResult(null);
  }, []);

  const getResultByCoordinates = useCallback((coordinates: Coordinates, tolerance = 0.001): ServiceCoverageResult | null => {
    return results.find(result => 
      Math.abs(result.coordinates.lat - coordinates.lat) < tolerance &&
      Math.abs(result.coordinates.lng - coordinates.lng) < tolerance
    ) || null;
  }, [results]);

  return {
    checkServiceAtCoordinates,
    checkMultipleCoordinates,
    isLoading: isLoading || reverseGeocodeLoading,
    error: reverseGeocodeError,
    currentResult,
    results,
    clearResults,
    getResultByCoordinates
  };
};