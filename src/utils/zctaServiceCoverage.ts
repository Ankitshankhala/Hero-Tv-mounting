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

    // ✅ DATABASE IS SOURCE OF TRUTH: Only database coverage counts for booking
    const finalCoverage = dbHasCoverage;
    const finalWorkerCount = dbWorkerCount; // Actual workers who service this exact ZIP

    let coverageSource: 'zcta' | 'database' | 'both' | 'none' = 'none';
    
    if (dbHasCoverage && zctaData?.is_valid) {
      // Best case: Database coverage + ZCTA location enrichment
      coverageSource = 'both';
    } else if (dbHasCoverage) {
      // Good case: Database coverage only
      coverageSource = 'database';
    } else if (zctaHasCoverage) {
      // ⚠️ ZCTA thinks there's coverage but database disagrees
      // This means worker service areas overlap geographically but
      // the worker hasn't explicitly added this ZIP
      coverageSource = 'none';
      console.warn(`[Coverage Check] ZIP ${cleanZipcode} has ZCTA geographic overlap but no explicit worker service coverage. Worker may need to add this ZIP to their service areas.`);
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

    // ✅ NEW: Skip ZCTA worker lookup, go directly to database for strict ZIP matching
    // ZCTA is now only used for validation/location in the booking flow, not worker finding
    console.log('[Worker Finder] Using strict ZIP matching for worker availability:', cleanZipcode);

    // Use database RPC with strict ZIP matching
    const { data: dbWorkers, error: dbError } = await supabase.rpc('find_available_workers_by_zip', {
      p_zipcode: cleanZipcode,
      p_date: date,
      p_time: time,
      p_duration_minutes: duration
    });
    
    if (dbError) {
      // Handle enum validation errors gracefully - return empty array instead of throwing
      if (dbError.message?.includes('invalid input value for enum day_of_week')) {
        console.error('Database configuration error - day_of_week enum mismatch. Migration may be pending.');
        return [];
      }
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