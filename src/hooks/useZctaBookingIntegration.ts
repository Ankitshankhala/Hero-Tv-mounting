import { useState, useCallback } from 'react';
import { zctaOnlyService, ZctaValidationResult, WorkerAreaAssignment } from '@/services/zctaOnlyService';

export interface ZctaBookingIntegration {
  // ZCTA validation
  validateZctaCode: (zctaCode: string) => Promise<ZctaValidationResult>;
  validationResult: ZctaValidationResult | null;
  validationLoading: boolean;
  
  // Worker finding
  findAvailableWorkers: (zctaCode: string, date: string, time: string, duration?: number) => Promise<WorkerAreaAssignment[]>;
  availableWorkers: WorkerAreaAssignment[];
  workersLoading: boolean;
  
  // Booking assignment
  autoAssignBooking: (bookingId: string) => Promise<any>;
  assignmentResult: any;
  assignmentLoading: boolean;
  
  // Coverage checking
  checkCoverage: (zctaCode: string) => Promise<{ hasActive: boolean; workerCount: number; workers?: Array<{id: string; name: string; city?: string; coverage_source?: string;}> }>;
  coverageResult: { hasActive: boolean; workerCount: number; workers?: Array<{id: string; name: string; city?: string; coverage_source?: string;}> } | null;
  coverageLoading: boolean;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for ZCTA-based booking integration
 * 
 * This hook provides all the necessary functions to integrate ZCTA-only
 * location services with the existing booking system while maintaining
 * full backward compatibility.
 */
export const useZctaBookingIntegration = (): ZctaBookingIntegration => {
  // State management
  const [validationResult, setValidationResult] = useState<ZctaValidationResult | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  
  const [availableWorkers, setAvailableWorkers] = useState<WorkerAreaAssignment[]>([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  
  const [assignmentResult, setAssignmentResult] = useState<any>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  
  const [coverageResult, setCoverageResult] = useState<{ hasActive: boolean; workerCount: number; workers?: Array<{id: string; name: string; city?: string; coverage_source?: string;}> } | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Validate ZCTA code
  const validateZctaCode = useCallback(async (zctaCode: string): Promise<ZctaValidationResult> => {
    setValidationLoading(true);
    setError(null);
    
    try {
      const result = await zctaOnlyService.validateZctaCode(zctaCode);
      setValidationResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate ZCTA code';
      setError(errorMessage);
      throw err;
    } finally {
      setValidationLoading(false);
    }
  }, []);

  // Find available workers
  const findAvailableWorkers = useCallback(async (
    zctaCode: string, 
    date: string, 
    time: string, 
    duration: number = 60
  ): Promise<WorkerAreaAssignment[]> => {
    setWorkersLoading(true);
    setError(null);
    
    try {
      const workers = await zctaOnlyService.findAvailableWorkersWithAreaInfo(
        zctaCode, date, time, duration
      );
      setAvailableWorkers(workers);
      return workers;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to find available workers';
      setError(errorMessage);
      setAvailableWorkers([]);
      return [];
    } finally {
      setWorkersLoading(false);
    }
  }, []);

  // Auto-assign booking
  const autoAssignBooking = useCallback(async (bookingId: string) => {
    setAssignmentLoading(true);
    setError(null);
    
    try {
      const result = await zctaOnlyService.autoAssignWorkerToBooking(bookingId);
      setAssignmentResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign worker to booking';
      setError(errorMessage);
      const failedResult = {
        assigned_worker_id: null,
        assignment_status: 'failed',
        worker_name: null,
        area_name: null,
        zcta_code: '',
        data_source: 'error'
      };
      setAssignmentResult(failedResult);
      return failedResult;
    } finally {
      setAssignmentLoading(false);
    }
  }, []);

  // Check coverage
  const checkCoverage = useCallback(async (zctaCode: string): Promise<{ hasActive: boolean; workerCount: number; workers?: Array<{id: string; name: string; city?: string; coverage_source?: string;}> }> => {
    setCoverageLoading(true);
    setError(null);
    
    try {
      const [hasActive, workerCount, workers] = await Promise.all([
        zctaOnlyService.hasActiveCoverage(zctaCode),
        zctaOnlyService.getWorkerCount(zctaCode),
        zctaOnlyService.findAvailableWorkersWithAreaInfo(zctaCode, new Date().toISOString().split('T')[0], '09:00').then(w => 
          w.map(worker => ({
            id: worker.worker_id,
            name: worker.worker_name,
            city: worker.area_name || '',
            coverage_source: 'zcta'
          }))
        ).catch(() => [])
      ]);
      
      const result = { hasActive, workerCount, workers };
      setCoverageResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check coverage';
      setError(errorMessage);
      const fallbackResult = { hasActive: false, workerCount: 0, workers: [] };
      setCoverageResult(fallbackResult);
      return fallbackResult;
    } finally {
      setCoverageLoading(false);
    }
  }, []);

  return {
    // ZCTA validation
    validateZctaCode,
    validationResult,
    validationLoading,
    
    // Worker finding
    findAvailableWorkers,
    availableWorkers,
    workersLoading,
    
    // Booking assignment
    autoAssignBooking,
    assignmentResult,
    assignmentLoading,
    
    // Coverage checking
    checkCoverage,
    coverageResult,
    coverageLoading,
    
    // Error handling
    error,
    clearError
  };
};

/**
 * Hook for backward compatibility with existing ZIP code validation
 * 
 * This hook provides the same interface as existing ZIP validation hooks
 * but uses ZCTA validation under the hood.
 */
export const useZipcodeValidationCompat = () => {
  const {
    validateZctaCode,
    validationResult,
    validationLoading,
    checkCoverage,
    coverageResult,
    coverageLoading,
    error,
    clearError
  } = useZctaBookingIntegration();

  const [validationData, setValidationData] = useState<any>(null);

  const validateZipcode = useCallback(async (zipcode: string) => {
    try {
      // Single combined call instead of Promise.all with duplicate queries - MASSIVE PERFORMANCE BOOST!
      const { validation, coverage } = await zctaOnlyService.validateZctaCodeWithCoverage(zipcode);
      
      const result = {
        isValid: validation.is_valid,
        hasServiceCoverage: coverage.hasActive,
        workerCount: coverage.workerCount,
        locationData: {
          city: validation.city,
          state: validation.state,
          stateAbbr: validation.state_abbr,
          latitude: validation.centroid_lat,
          longitude: validation.centroid_lng
        },
        // Enhanced ZCTA-specific data
        zctaData: {
          has_boundary_data: validation.has_boundary_data,
          total_area_sq_miles: validation.total_area_sq_miles,
          data_source: validation.data_source,
          can_use_for_service: validation.can_use_for_service
        },
        // Workers already loaded!
        workers: coverage.workers
      };
      
      setValidationData(result);
      return result;
    } catch (err) {
      console.error('Validation error:', err);
      setValidationData(null);
      throw err;
    }
  }, []);

  return {
    validateZipcode,
    isLoading: validationLoading || coverageLoading,
    error,
    clearError,
    // Expose raw ZCTA results for enhanced functionality
    zctaValidation: validationResult,
    coverageInfo: coverageResult,
    validationData
  };
};

export default useZctaBookingIntegration;
