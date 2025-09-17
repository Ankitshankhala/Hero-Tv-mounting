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
    
    // Check cache first
    if (zctaServiceCoverageCache.has(cleanZipcode)) {
      return zctaServiceCoverageCache.get(cleanZipcode)!;
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
      } : undefined
    };
    
    // Cache the result
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
  duration: number = 60
) => {
  try {
    // Try ZCTA-based worker finding first
    const zctaWorkers = await zctaOnlyService.findAvailableWorkersWithAreaInfo(
      zipcode, date, time, duration
    );
    
    if (zctaWorkers.length > 0) {
      return zctaWorkers.map(worker => ({
        ...worker,
        assignment_source: 'zcta' as const
      }));
    }
    
    // Fallback to database-based worker finding
    const { data: dbWorkers } = await supabase.rpc('find_available_workers_by_zip', {
      p_zipcode: zipcode,
      p_date: date,
      p_time: time,
      p_duration_minutes: duration
    });
    
    return (dbWorkers || []).map((worker: any) => ({
      ...worker,
      assignment_source: 'database' as const
    }));
    
  } catch (error) {
    console.error('Error finding ZCTA available workers:', error);
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