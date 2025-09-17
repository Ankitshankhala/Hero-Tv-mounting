import { supabase } from "@/integrations/supabase/client";
import { zctaOnlyService } from '@/services/zctaOnlyService';
import { getServiceCoverageInfo } from './zipcodeValidation';

export interface ZctaServiceCoverageData {
  hasServiceCoverage: boolean;
  workerCount: number;
  coverageSource: 'zcta' | 'database' | 'both' | 'none';
  zctaData?: {
    is_valid: boolean;
    can_use_for_service: boolean;
    city: string;
    state: string;
    state_abbr: string;
  };
}

// Cache for ZCTA service coverage to avoid repeated computations
const zctaServiceCoverageCache = new Map<string, ZctaServiceCoverageData>();

/**
 * Enhanced service coverage check using ZCTA data primarily with database fallback
 */
export const getZctaServiceCoverage = async (customerZipcode: string): Promise<ZctaServiceCoverageData> => {
  try {
    // Clean zipcode
    const cleanZipcode = customerZipcode.replace(/[^\d]/g, '').substring(0, 5);
    
    // Validate zipcode format
    if (!cleanZipcode || cleanZipcode.length !== 5) {
      return {
        hasServiceCoverage: false,
        workerCount: 0,
        coverageSource: 'none'
      };
    }
    
    // Check cache first (with expiration)
    const cacheKey = `${cleanZipcode}_${Date.now()}`;
    const cached = zctaServiceCoverageCache.get(cleanZipcode);
    if (cached && Date.now() - (cached as any)._timestamp < 300000) { // 5 min cache
      return cached;
    }
    
    // Run ZCTA validation and database coverage check in parallel
    const [zctaValidation, databaseCoverage] = await Promise.allSettled([
      zctaOnlyService.validateZctaCode(cleanZipcode),
      getServiceCoverageInfo(cleanZipcode)
    ]);

    let zctaHasCoverage = false;
    let zctaWorkerCount = 0;
    let zctaData = undefined;

    // Process ZCTA validation result
    if (zctaValidation.status === 'fulfilled' && zctaValidation.value.is_valid) {
      zctaData = zctaValidation.value;
      
      try {
        // Check ZCTA-based coverage
        const [hasCoverage, workerCount] = await Promise.all([
          zctaOnlyService.hasActiveCoverage(cleanZipcode),
          zctaOnlyService.getWorkerCount(cleanZipcode)
        ]);
        
        zctaHasCoverage = hasCoverage;
        zctaWorkerCount = workerCount;
      } catch (error) {
        console.warn('ZCTA coverage check failed:', error);
      }
    }

    // Process database coverage result
    let dbHasCoverage = false;
    let dbWorkerCount = 0;
    if (databaseCoverage.status === 'fulfilled') {
      dbHasCoverage = databaseCoverage.value.hasServiceCoverage;
      dbWorkerCount = databaseCoverage.value.workerCount;
    }

    // Determine final coverage and source
    let finalCoverage = false;
    let finalWorkerCount = 0;
    let coverageSource: 'zcta' | 'database' | 'both' | 'none' = 'none';

    if (zctaHasCoverage && dbHasCoverage) {
      finalCoverage = true;
      finalWorkerCount = Math.max(zctaWorkerCount, dbWorkerCount); // Use higher count
      coverageSource = 'both';
    } else if (zctaHasCoverage) {
      finalCoverage = true;
      finalWorkerCount = zctaWorkerCount;
      coverageSource = 'zcta';
    } else if (dbHasCoverage) {
      finalCoverage = true;
      finalWorkerCount = dbWorkerCount;
      coverageSource = 'database';
    }

    const result: ZctaServiceCoverageData = {
      hasServiceCoverage: finalCoverage,
      workerCount: finalWorkerCount,
      coverageSource,
      zctaData: zctaData ? {
        is_valid: zctaData.is_valid,
        can_use_for_service: zctaData.can_use_for_service,
        city: zctaData.city,
        state: zctaData.state,
        state_abbr: zctaData.state_abbr
      } : undefined,
      // Add timestamp for cache expiration
      _timestamp: Date.now()
    } as ZctaServiceCoverageData & { _timestamp: number };
    
    // Cache the result with timestamp
    zctaServiceCoverageCache.set(cleanZipcode, result);
    return result;
    
  } catch (error) {
    console.error('Error checking ZCTA service coverage:', error);
    
    // Fallback to database-only coverage
    try {
      const dbCoverage = await getServiceCoverageInfo(customerZipcode);
      const fallbackResult: ZctaServiceCoverageData = {
        hasServiceCoverage: dbCoverage.hasServiceCoverage,
        workerCount: dbCoverage.workerCount,
        coverageSource: dbCoverage.hasServiceCoverage ? 'database' : 'none'
      };
      
      zctaServiceCoverageCache.set(customerZipcode.replace(/[^\d]/g, '').substring(0, 5), fallbackResult);
      return fallbackResult;
    } catch (fallbackError) {
      console.error('Database fallback also failed:', fallbackError);
      return {
        hasServiceCoverage: false,
        workerCount: 0,
        coverageSource: 'none'
      };
    }
  }
};

/**
 * Enhanced worker availability check using ZCTA data
 */
export const findZctaAvailableWorkers = async (
  zipcode: string, 
  date: string, 
  time: string, 
  duration: number = 60,
  retryCount: number = 0
) => {
  const maxRetries = 2;
  
  try {
    // Clean and validate zipcode
    const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
    if (!cleanZipcode || cleanZipcode.length !== 5) {
      throw new Error('Invalid ZIP code format');
    }
    
    // Try ZCTA-based worker finding first with retry logic
    let zctaWorkers = [];
    try {
      zctaWorkers = await Promise.race([
        zctaOnlyService.findAvailableWorkersWithAreaInfo(cleanZipcode, date, time, duration),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('ZCTA service timeout')), 10000)
        )
      ]) as any[];
      
      if (zctaWorkers.length > 0) {
        return zctaWorkers.map(worker => ({
          ...worker,
          assignment_source: 'zcta' as const,
          // Enhanced worker details
          service_area: worker.service_area || `${cleanZipcode} area`,
          avg_response_time: worker.avg_response_time || '30-60 mins',
          specializations: worker.specializations || ['General Service']
        }));
      }
    } catch (zctaError) {
      console.warn(`ZCTA worker search failed (attempt ${retryCount + 1}):`, zctaError);
      
      // Retry ZCTA on network errors
      if (retryCount < maxRetries && (zctaError as Error).message.includes('timeout')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return findZctaAvailableWorkers(zipcode, date, time, duration, retryCount + 1);
      }
    }
    
    // Fallback to database-based worker finding
    console.log('Falling back to database worker search for:', cleanZipcode);
    const { data: dbWorkers, error: dbError } = await supabase.rpc('find_available_workers_by_zip', {
      p_zipcode: cleanZipcode,
      p_date: date,
      p_time: time,
      p_duration_minutes: duration
    });
    
    if (dbError) {
      throw new Error(`Database search failed: ${dbError.message}`);
    }
    
    return (dbWorkers || []).map((worker: any) => ({
      ...worker,
      assignment_source: 'database' as const,
      service_area: worker.service_area || `${cleanZipcode} area`,
      avg_response_time: worker.avg_response_time || '45-90 mins',
      specializations: worker.specializations || ['General Service']
    }));
    
  } catch (error) {
    console.error('Error finding available workers:', error);
    
    // Final retry for critical errors
    if (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
      return findZctaAvailableWorkers(zipcode, date, time, duration, retryCount + 1);
    }
    
    return [];
  }
};

/**
 * Cache management utilities
 */
export const clearZctaServiceCoverageCache = () => {
  zctaServiceCoverageCache.clear();
};

export const clearZctaServiceCoverageFromCache = (zipcode: string) => {
  const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
  zctaServiceCoverageCache.delete(cleanZipcode);
};