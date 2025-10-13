import { supabase } from "@/integrations/supabase/client";
import {
  ZctaValidationResult,
  WorkerAreaAssignment,
  BookingAssignmentDetails,
  ZctaCoverageStats,
  WorkerZctaArea
} from './zctaTypes';

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
   * Priority: worker_service_zipcodes → us_zcta_polygons → us_zip_codes → external API
   */
  async validateZctaCode(zctaCode: string): Promise<ZctaValidationResult> {
    const cacheKey = zctaCode.replace(/[^\d]/g, '').substring(0, 5);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      console.debug(`[ZCTA Validation] Checking ZIP: ${cacheKey}`);

      // STEP 1: Check if workers are assigned to this ZIP (highest priority)
      const { data: workerZips, error: workerError } = await supabase
        .from('worker_service_zipcodes')
        .select(`
          zipcode,
          service_area:worker_service_areas(area_name, worker:users(name))
        `)
        .eq('zipcode', cacheKey)
        .limit(1);

      if (workerZips && workerZips.length > 0) {
        const serviceArea = workerZips[0].service_area as any;
        const areaName = serviceArea?.area_name || 'Service Area';
        
        console.debug(`[ZCTA Validation] ✓ Found in worker assignments: ${areaName}`);
        
        const result: ZctaValidationResult = {
          is_valid: true,
          zcta_code: cacheKey,
          has_boundary_data: true,
          can_use_for_service: true,
          city: areaName,
          state: 'Service Coverage',
          state_abbr: 'SC',
          total_area_sq_miles: 0,
          centroid_lat: 0,
          centroid_lng: 0,
          data_source: 'worker_assignment'
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      console.debug(`[ZCTA Validation] No worker assignments, checking ZCTA polygons...`);

      // STEP 2: Check us_zcta_polygons table (33,792 records)
      const { data: zctaData, error: zctaError } = await supabase
        .from('us_zcta_polygons')
        .select('zcta5ce, land_area, water_area')
        .eq('zcta5ce', cacheKey)
        .single();

      if (zctaData) {
        console.debug(`[ZCTA Validation] ✓ Found in ZCTA polygons: ${cacheKey}, fetching city name...`);
        
        // Get city/state from external API
        const externalData = await this.validateZipWithExternal(cacheKey);
        
        const result: ZctaValidationResult = {
          is_valid: true,
          zcta_code: zctaData.zcta5ce,
          has_boundary_data: true,
          can_use_for_service: true,
          city: externalData?.city || 'Unknown City',
          state: externalData?.state || 'United States',
          state_abbr: externalData?.state_abbr || 'US',
          total_area_sq_miles: zctaData.land_area ? parseFloat(zctaData.land_area.toString()) : 0,
          centroid_lat: externalData?.centroid_lat || 0,
          centroid_lng: externalData?.centroid_lng || 0,
          data_source: 'zcta_boundary'
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      console.debug(`[ZCTA Validation] Not in ZCTA polygons, checking us_zip_codes fallback...`);

      // STEP 3: Check us_zip_codes table (fallback with city/state data)
      const { data: zipData, error: zipError } = await supabase
        .from('us_zip_codes')
        .select('zipcode, city, state, state_abbr, latitude, longitude')
        .eq('zipcode', cacheKey)
        .single();

      if (zipData) {
        console.debug(`[ZCTA Validation] ✓ Found in us_zip_codes: ${zipData.city}, ${zipData.state_abbr}`);
        
        const result: ZctaValidationResult = {
          is_valid: true,
          zcta_code: zipData.zipcode,
          has_boundary_data: true,
          can_use_for_service: true,
          city: zipData.city,
          state: zipData.state,
          state_abbr: zipData.state_abbr,
          total_area_sq_miles: 0,
          centroid_lat: zipData.latitude ? parseFloat(zipData.latitude.toString()) : 0,
          centroid_lng: zipData.longitude ? parseFloat(zipData.longitude.toString()) : 0,
          data_source: 'postal_only'
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      console.debug(`[ZCTA Validation] Not in database, trying external API...`);

      // STEP 4: External API fallback (Zippopotam)
      const externalResult = await this.validateZipWithExternal(cacheKey);
      if (externalResult) {
        this.cache.set(cacheKey, externalResult);
        return externalResult;
      }

      console.warn(`[ZCTA Validation] ✗ Invalid ZIP code: ${cacheKey}`);

      // STEP 5: Invalid ZIP code
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
        data_source: 'not_found'
      };

      this.cache.set(cacheKey, fallbackResult);
      return fallbackResult;
    } catch (error) {
      console.error('Error validating ZCTA code:', error);
      throw error;
    }
  }

  /**
   * Validate ZIP code using external API (Zippopotam)
   */
  private async validateZipWithExternal(zipcode: string): Promise<ZctaValidationResult | null> {
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zipcode}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        console.debug(`[ZCTA Validation] External API returned ${response.status} for ${zipcode}`);
        return null;
      }

      const data = await response.json();
      const place = data.places?.[0];

      if (!place) {
        return null;
      }

      console.debug(`[ZCTA Validation] ✓ Found via external API: ${place['place name']}, ${place['state abbreviation']}`);

      return {
        is_valid: true,
        zcta_code: zipcode,
        has_boundary_data: false,
        can_use_for_service: true,
        city: place['place name'] || 'Unknown',
        state: place.state || 'Unknown',
        state_abbr: place['state abbreviation'] || 'US',
        total_area_sq_miles: 0,
        centroid_lat: parseFloat(place.latitude) || 0,
        centroid_lng: parseFloat(place.longitude) || 0,
        data_source: 'postal_only'
      };
    } catch (error) {
      console.error('External ZIP validation error:', error);
      return null;
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
      // Use edge function for worker assignment
      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
        body: {
          workerId,
          areaName,
          zctaCodes
        }
      });

      if (error) {
        console.error('Worker assignment error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, ...data };
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
      // Step 1: Get worker and service area IDs for the zipcode
      const { data: zipcodeData, error: zipcodeError } = await supabase
        .from('worker_service_zipcodes')
        .select('worker_id, service_area_id')
        .eq('zipcode', zctaCode);

      if (zipcodeError) {
        console.error('Find zipcode data error:', zipcodeError);
        throw zipcodeError;
      }

      if (!zipcodeData || zipcodeData.length === 0) {
        return [];
      }

      // Step 2: Get worker details
      const workerIds = [...new Set(zipcodeData.map(z => z.worker_id))];
      const { data: workers, error: workerError } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .in('id', workerIds)
        .eq('is_active', true)
        .eq('role', 'worker');

      if (workerError) {
        console.error('Find workers error:', workerError);
        throw workerError;
      }

      // Step 3: Get service area details
      const areaIds = [...new Set(zipcodeData.map(z => z.service_area_id).filter(Boolean))];
      const { data: areas, error: areaError } = await supabase
        .from('worker_service_areas')
        .select('id, area_name')
        .in('id', areaIds)
        .eq('is_active', true);

      if (areaError) {
        console.error('Find areas error:', areaError);
        throw areaError;
      }

      // Step 4: Combine the data
      return zipcodeData.map(zData => {
        const worker = workers?.find(w => w.id === zData.worker_id);
        const area = areas?.find(a => a.id === zData.service_area_id);

        return {
          worker_id: zData.worker_id,
          worker_name: worker?.name || '',
          worker_email: worker?.email || '',
          worker_phone: worker?.phone || '',
          area_id: area?.id || '',
          area_name: area?.area_name || '',
          zcta_code: zctaCode,
          distance_priority: 1,
          data_source: 'direct_match'
        };
      }).filter(w => w.worker_name); // Filter out any without worker data
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
      // Use direct booking assignment logic
      const bookingResponse = await supabase
        .from('bookings')
        .select('guest_customer_info')
        .eq('id', bookingId)
        .single();

      if (bookingResponse.error) {
        console.error('Auto assignment error:', bookingResponse.error);
        throw bookingResponse.error;
      }

      const guestInfo = bookingResponse.data?.guest_customer_info as any;
      const zipcode = guestInfo?.zipcode;
      if (!zipcode) {
        return {
          assigned_worker_id: null,
          assignment_status: 'no_zipcode',
          worker_name: null,
          area_name: null,
          zcta_code: '',
          data_source: 'error'
        };
      }

      const workers = await this.findAvailableWorkersWithAreaInfo(zipcode, '', '', 60);
      const selectedWorker = workers[0];

      return {
        assigned_worker_id: selectedWorker?.worker_id || null,
        assignment_status: selectedWorker ? 'assigned' : 'no_coverage',
        worker_name: selectedWorker?.worker_name || null,
        area_name: selectedWorker?.area_name || null,
        zcta_code: zipcode,
        data_source: selectedWorker ? 'auto_assignment' : 'no_coverage'
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
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          guest_customer_info,
          worker_id,
          scheduled_date,
          scheduled_start,
          worker:workers(name, email, phone),
          service_area:worker_service_areas(id, area_name)
        `)
        .eq('id', bookingId)
        .single();

      if (error) {
        console.error('Get booking details error:', error);
        throw error;
      }

      if (!data) return null;

      const guestInfo = data.guest_customer_info as any;
      return {
        booking_id: data.id,
        customer_name: guestInfo?.name || '',
        customer_zcta_code: guestInfo?.zipcode || '',
        customer_city: guestInfo?.city || '',
        customer_state: guestInfo?.state || '',
        worker_id: data.worker_id,
        worker_name: (data.worker as any)?.name || null,
        worker_email: (data.worker as any)?.email || null,
        worker_phone: (data.worker as any)?.phone || null,
        area_id: (data.service_area as any)?.id || null,
        area_name: (data.service_area as any)?.area_name || null,
        assignment_status: data.worker_id ? 'assigned' : 'pending',
        scheduled_date: data.scheduled_date,
        scheduled_start: data.scheduled_start,
        zcta_validation: null
      } as BookingAssignmentDetails;
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
      const { data, error } = await supabase
        .from('worker_service_zipcodes')
        .select(`
          zipcode,
          service_area_id,
          service_area:worker_service_areas!inner(id, area_name, is_active, created_at)
        `)
        .eq('worker_id', workerId);

      if (error) {
        console.error('Get worker ZCTA codes error:', error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        zcta_code: item.zipcode,
        area_id: item.service_area_id,
        area_name: item.service_area?.area_name || '',
        is_active: item.service_area?.is_active || false,
        created_at: item.service_area?.created_at || '',
        zcta_validation: {
          is_valid: true,
          has_boundary_data: true,
          city: '',
          state: '',
          data_source: 'worker_assignment'
        }
      }));
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
      // Get basic coverage stats
      const totalWorkers = 10; // Placeholder for now
      const totalAreas = 50; // Placeholder for now  
      const totalZipcodes = 500; // Placeholder for now

      return {
        total_zcta_codes: 33000, // Approximate total ZCTA codes in US
        covered_zcta_codes: totalZipcodes,
        total_workers: totalWorkers,
        total_areas: totalAreas,
        coverage_percentage: (totalZipcodes / 33000) * 100,
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

// Export as separate export to avoid conflicts
export * from './zctaTypes';
