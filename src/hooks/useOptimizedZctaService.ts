import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ZctaServiceCoverageResult {
  has_coverage: boolean;
  worker_count: number;
  active_workers: string[];
}

interface UseOptimizedZctaServiceReturn {
  loading: boolean;
  error: string | null;
  checkZipCoverage: (zipcode: string) => Promise<ZctaServiceCoverageResult>;
  clearError: () => void;
}

/**
 * Optimized hook for ZCTA service operations using database-only queries
 * Replaces client-side spatial processing with server-side PostGIS queries
 */
export const useOptimizedZctaService = (): UseOptimizedZctaServiceReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkZipCoverage = useCallback(async (zipcode: string): Promise<ZctaServiceCoverageResult> => {
    setLoading(true);
    setError(null);

    try {
      // Use the optimized database function for coverage checking
      const { data, error: rpcError } = await supabase.rpc('get_zip_coverage_info', {
        p_zipcode: zipcode.trim()
      });

      if (rpcError) {
        throw new Error(`Coverage check failed: ${rpcError.message}`);
      }

      if (!data || data.length === 0) {
        return {
          has_coverage: false,
          worker_count: 0,
          active_workers: []
        };
      }

      const result = data[0];
      return {
        has_coverage: result.has_coverage || false,
        worker_count: result.worker_count || 0,
        active_workers: result.active_workers || []
      };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      console.error('ZIP coverage check failed:', err);
      
      // Return default values on error
      return {
        has_coverage: false,
        worker_count: 0,
        active_workers: []
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    checkZipCoverage,
    clearError
  };
};