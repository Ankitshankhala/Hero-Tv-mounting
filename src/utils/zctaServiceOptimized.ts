import { supabase } from '@/integrations/supabase/client';

interface ZctaServiceCoverageData {
  hasActive: boolean;
  workerCount: number;
  workers?: Array<{
    id: string;
    name: string;
    city?: string;
    coverage_source: string;
  }>;
  source: string;
  zcta_data?: {
    zipcode: string;
    is_valid: boolean;
  };
}

/**
 * Optimized ZCTA service coverage using database-only queries
 * Replaces client-side spatial processing with server-side PostGIS
 */
export const getOptimizedZctaServiceCoverage = async (customerZipcode: string): Promise<ZctaServiceCoverageData> => {
  try {
    console.log('🔍 Checking ZIP coverage using optimized database query:', customerZipcode);

    // Use the optimized database function
    const { data: coverageData, error } = await supabase.rpc('get_zip_coverage_info', {
      p_zipcode: customerZipcode.trim()
    });

    if (error) {
      console.error('❌ Database coverage query failed:', error);
      throw error;
    }

    if (!coverageData || coverageData.length === 0) {
      console.log('⚠️ No coverage data found for ZIP:', customerZipcode);
      return {
        hasActive: false,
        workerCount: 0,
        workers: [],
        source: 'database_query',
        zcta_data: {
          zipcode: customerZipcode,
          is_valid: false
        }
      };
    }

    const result = coverageData[0];
    console.log('✅ Coverage data retrieved:', {
      zipcode: customerZipcode,
      has_coverage: result.has_coverage,
      worker_count: result.worker_count
    });

    // If we have coverage, get worker details
    let workers: Array<{id: string; name: string; city?: string; coverage_source: string}> = [];
    
    if (result.has_coverage && result.active_workers && result.active_workers.length > 0) {
      const { data: workerDetails, error: workerError } = await supabase
        .from('users')
        .select('id, name, city')
        .in('id', result.active_workers)
        .eq('role', 'worker')
        .eq('is_active', true);

      if (!workerError && workerDetails) {
        workers = workerDetails.map(worker => ({
          id: worker.id,
          name: worker.name || 'Unnamed Worker',
          city: worker.city || '',
          coverage_source: 'zcta_optimized'
        }));
      }
    }

    return {
      hasActive: result.has_coverage || false,
      workerCount: result.worker_count || 0,
      workers,
      source: 'zcta_optimized_database',
      zcta_data: {
        zipcode: customerZipcode,
        is_valid: result.has_coverage || false
      }
    };

  } catch (error) {
    console.error('❌ Optimized ZCTA service coverage failed:', error);
    
    return {
      hasActive: false,
      workerCount: 0,
      workers: [],
      source: 'error',
      zcta_data: {
        zipcode: customerZipcode,
        is_valid: false
      }
    };
  }
};

/**
 * Find available workers using optimized database queries
 */
export const findOptimizedZctaAvailableWorkers = async (
  zipcode: string, 
  date: string, 
  time: string, 
  duration: number = 60
): Promise<Array<any>> => {
  try {
    console.log('🔍 Finding available workers using optimized query:', { zipcode, date, time });

    // First check if we have coverage
    const coverageData = await getOptimizedZctaServiceCoverage(zipcode);
    
    if (!coverageData.hasActive || !coverageData.workers || coverageData.workers.length === 0) {
      console.log('⚠️ No active coverage for ZIP:', zipcode);
      return [];
    }

    // Get worker IDs with coverage
    const workerIds = coverageData.workers.map(w => w.id);

    // Use a simpler approach - check worker availability for the identified workers
    const { data: availableWorkers, error } = await supabase
      .from('worker_availability')
      .select(`
        worker_id,
        day_of_week,
        start_time,
        end_time,
        users!inner(id, name, city, role, is_active)
      `)
      .in('worker_id', workerIds)
      .eq('users.is_active', true)
      .eq('users.role', 'worker');

    if (error) {
      console.error('❌ Worker availability query failed:', error);
      return [];
    }

    // Filter results to only include workers with ZCTA coverage
    const filteredWorkers = (availableWorkers || []).filter(worker => 
      workerIds.includes(worker.worker_id)
    );

    console.log('✅ Found available workers with ZCTA coverage:', filteredWorkers.length);
    
    return filteredWorkers.map(worker => ({
      ...worker,
      assignment_source: 'zcta_optimized',
      coverage_source: 'zcta_database'
    }));

  } catch (error) {
    console.error('❌ Optimized worker finding failed:', error);
    return [];
  }
};

/**
 * Clear any caches (placeholder for future caching implementation)
 */
export const clearOptimizedZctaCache = (): void => {
  console.log('🧹 Optimized ZCTA cache cleared (no-op in database-only implementation)');
};