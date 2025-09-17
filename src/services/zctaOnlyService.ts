import { supabase } from "@/integrations/supabase/client";

// ZCTA-Only Service Interface Types
export interface ZctaValidationResult {
  is_valid: boolean;
  zcta_code: string;
  has_boundary_data: boolean;
  can_use_for_service: boolean;
  city: string;
  state: string;
  state_abbr: string;
  total_area_sq_miles: number;
  centroid_lat: number;
  centroid_lng: number;
  data_source: 'zcta_boundary' | 'postal_only' | 'not_found' | 'invalid';
}

export interface WorkerAreaAssignment {
  worker_id: string;
  worker_name: string;
  worker_email: string;
  worker_phone: string;
  area_id: string;
  area_name: string;
  zcta_code: string;
  distance_priority: number;
  data_source: string;
}

export interface BookingAssignmentDetails {
  booking_id: string;
  customer_name: string;
  customer_zcta_code: string;
  customer_city: string;
  customer_state: string;
  worker_id: string | null;
  worker_name: string | null;
  worker_email: string | null;
  worker_phone: string | null;
  area_id: string | null;
  area_name: string | null;
  assignment_status: 'assigned' | 'pending' | 'unassigned';
  scheduled_date: string;
  scheduled_start: string;
  zcta_validation: {
    is_valid: boolean;
    has_boundary_data: boolean;
    data_source: string;
    total_area_sq_miles: number;
  } | null;
}

export interface ZctaCoverageStats {
  total_zcta_codes: number;
  covered_zcta_codes: number;
  total_workers: number;
  total_areas: number;
  coverage_percentage: number;
  top_states: Record<string, number>;
}

export interface WorkerZctaArea {
  zcta_code: string;
  area_id: string;
  area_name: string;
  is_active: boolean;
  created_at: string;
  zcta_validation: {
    is_valid: boolean;
    has_boundary_data: boolean;
    city: string;
    state: string;
    data_source: string;
  };
}

/**
 * ZCTA-Only Service
 * 
 * This service provides a complete ZCTA-only interface for location operations
 * while maintaining full backward compatibility with existing booking systems.
 * 
 * Key Features:
 * - ZCTA code validation with comprehensive location data
 * - Worker assignment to ZCTA codes with area names
 * - Booking compatibility with enhanced assignment details
 * - Coverage statistics and management
 */
export class ZctaOnlyService {
  private static instance: ZctaOnlyService;
  private cache = new Map<string, ZctaValidationResult>();

  static getInstance(): ZctaOnlyService {
    if (!ZctaOnlyService.instance) {
      ZctaOnlyService.instance = new ZctaOnlyService();
    }
    return ZctaOnlyService.instance;
  }

  /**
   * Validate ZCTA code and get comprehensive location data
   */
  async validateZctaCode(zctaCode: string): Promise<ZctaValidationResult> {
    const cacheKey = zctaCode.replace(/[^\d]/g, '').substring(0, 5);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const { data, error } = await supabase.rpc('validate_zcta_code', {
        p_zcta_code: zctaCode
      });

      if (error) {
        console.error('ZCTA validation error:', error);
        throw error;
      }

      const result = data?.[0] as ZctaValidationResult;
      if (result) {
        this.cache.set(cacheKey, result);
        return result;
      }

      // Fallback result for invalid codes
      const fallbackResult: ZctaValidationResult = {
        is_valid: false,
        zcta_code: cacheKey,
        has_boundary_data: false,
        can_use_for_service: false,
        city: 'Unknown',
        state: 'Unknown',
        state_abbr: 'Unknown',
        total_area_sq_miles: 0,
        centroid_lat: 0,
        centroid_lng: 0,
        data_source: 'invalid'
      };

      this.cache.set(cacheKey, fallbackResult);
      return fallbackResult;
    } catch (error) {
      console.error('Error validating ZCTA code:', error);
      throw error;
    }
  }

  /**
   * Assign worker to ZCTA codes with area name
   */
  async assignWorkerToZctaCodes(
    workerId: string,
    areaName: string,
    zctaCodes: string[]
  ): Promise<{
    success: boolean;
    area_id?: string;
    area_name?: string;
    worker_id?: string;
    assigned_zcta_codes?: number;
    invalid_codes?: string[];
    message?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('assign_worker_to_zcta_codes', {
        p_worker_id: workerId,
        p_area_name: areaName,
        p_zcta_codes: zctaCodes
      });

      if (error) {
        console.error('Worker assignment error:', error);
        return { success: false, error: error.message };
      }

      return data;
    } catch (error) {
      console.error('Error assigning worker to ZCTA codes:', error);
      return { success: false, error: 'Failed to assign worker to ZCTA codes' };
    }
  }

  /**
   * Find available workers for a ZCTA code with area information
   */
  async findAvailableWorkersWithAreaInfo(
    zctaCode: string,
    date: string,
    time: string,
    durationMinutes: number = 60
  ): Promise<WorkerAreaAssignment[]> {
    try {
      const { data, error } = await supabase.rpc('find_available_workers_with_area_info', {
        p_zcta_code: zctaCode,
        p_date: date,
        p_time: time,
        p_duration_minutes: durationMinutes
      });

      if (error) {
        console.error('Find workers error:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error finding available workers:', error);
      return [];
    }
  }

  /**
   * Auto-assign worker to booking with enhanced ZCTA validation
   */
  async autoAssignWorkerToBooking(bookingId: string): Promise<{
    assigned_worker_id: string | null;
    assignment_status: string;
    worker_name: string | null;
    area_name: string | null;
    zcta_code: string;
    data_source: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('auto_assign_worker_zcta_enhanced', {
        p_booking_id: bookingId
      });

      if (error) {
        console.error('Auto assignment error:', error);
        throw error;
      }

      return data?.[0] || {
        assigned_worker_id: null,
        assignment_status: 'failed',
        worker_name: null,
        area_name: null,
        zcta_code: '',
        data_source: 'error'
      };
    } catch (error) {
      console.error('Error auto-assigning worker:', error);
      throw error;
    }
  }

  /**
   * Get booking assignment details with ZCTA validation
   */
  async getBookingAssignmentDetails(bookingId: string): Promise<BookingAssignmentDetails | null> {
    try {
      const { data, error } = await supabase.rpc('get_booking_assignment_details_zcta', {
        p_booking_id: bookingId
      });

      if (error) {
        console.error('Get booking details error:', error);
        throw error;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Error getting booking assignment details:', error);
      return null;
    }
  }

  /**
   * Get all ZCTA codes for a worker with area names and validation
   */
  async getWorkerZctaCodesWithAreas(workerId: string): Promise<WorkerZctaArea[]> {
    try {
      const { data, error } = await supabase.rpc('get_worker_zcta_codes_with_areas', {
        p_worker_id: workerId
      });

      if (error) {
        console.error('Get worker ZCTA codes error:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting worker ZCTA codes:', error);
      return [];
    }
  }

  /**
   * Get ZCTA coverage statistics
   */
  async getZctaCoverageStats(): Promise<ZctaCoverageStats> {
    try {
      const { data, error } = await supabase.rpc('get_zcta_coverage_stats');

      if (error) {
        console.error('Get coverage stats error:', error);
        throw error;
      }

      return data?.[0] || {
        total_zcta_codes: 0,
        covered_zcta_codes: 0,
        total_workers: 0,
        total_areas: 0,
        coverage_percentage: 0,
        top_states: {}
      };
    } catch (error) {
      console.error('Error getting ZCTA coverage stats:', error);
      return {
        total_zcta_codes: 0,
        covered_zcta_codes: 0,
        total_workers: 0,
        total_areas: 0,
        coverage_percentage: 0,
        top_states: {}
      };
    }
  }

  /**
   * Check if ZCTA has active worker coverage
   */
  async hasActiveCoverage(zctaCode: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('zip_has_active_coverage_by_zip', {
        p_zipcode: zctaCode
      });

      if (error) {
        console.error('Coverage check error:', error);
        return false;
      }

      return Boolean(data);
    } catch (error) {
      console.error('Error checking active coverage:', error);
      return false;
    }
  }

  /**
   * Get worker count for ZCTA code
   */
  async getWorkerCount(zctaCode: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_worker_count_by_zip', {
        p_zipcode: zctaCode
      });

      if (error) {
        console.error('Worker count error:', error);
        return 0;
      }

      return Number(data) || 0;
    } catch (error) {
      console.error('Error getting worker count:', error);
      return 0;
    }
  }

  /**
   * Validate multiple ZCTA codes in batch
   */
  async validateMultipleZctaCodes(zctaCodes: string[]): Promise<ZctaValidationResult[]> {
    const results = await Promise.all(
      zctaCodes.map(code => this.validateZctaCode(code))
    );
    return results;
  }

  /**
   * Get recommendations for service area expansion
   */
  async getServiceAreaRecommendations(workerId: string): Promise<{
    current_coverage: WorkerZctaArea[];
    nearby_uncovered_zctas: string[];
    expansion_suggestions: {
      zcta_code: string;
      city: string;
      state: string;
      reason: string;
    }[];
  }> {
    try {
      // Get current worker coverage
      const currentCoverage = await this.getWorkerZctaCodesWithAreas(workerId);
      
      // For now, return basic structure - could be enhanced with spatial analysis
      return {
        current_coverage: currentCoverage,
        nearby_uncovered_zctas: [],
        expansion_suggestions: []
      };
    } catch (error) {
      console.error('Error getting service area recommendations:', error);
      return {
        current_coverage: [],
        nearby_uncovered_zctas: [],
        expansion_suggestions: []
      };
    }
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{
      zcta_code: string;
      is_valid: boolean;
      has_boundary_data: boolean;
      data_source: string;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([zcta_code, data]) => ({
      zcta_code,
      is_valid: data.is_valid,
      has_boundary_data: data.has_boundary_data,
      data_source: data.data_source
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

// Export singleton instance
export const zctaOnlyService = ZctaOnlyService.getInstance();

// Export types for external use
export type {
  ZctaValidationResult,
  WorkerAreaAssignment,
  BookingAssignmentDetails,
  ZctaCoverageStats,
  WorkerZctaArea
};
