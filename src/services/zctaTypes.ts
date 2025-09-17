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