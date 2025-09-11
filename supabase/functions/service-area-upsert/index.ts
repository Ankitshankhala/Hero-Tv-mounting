// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolygonPoint {
  lat: number;
  lng: number;
}

interface UpsertRequest {
  workerId: string;
  areaName: string;
  mode: 'replace_all' | 'append';
  polygon?: PolygonPoint[];
  zipcodesOnly?: string[];
}

// Sample US ZIP codes with coordinates (focused on major Texas cities)
const US_ZIPCODES = [
  { zipcode: '75201', lat: 32.7767, lng: -96.7970 }, // Dallas, TX
  { zipcode: '75202', lat: 32.7815, lng: -96.8047 }, // Dallas, TX
  { zipcode: '75203', lat: 32.7668, lng: -96.7836 }, // Dallas, TX
  { zipcode: '77001', lat: 29.7604, lng: -95.3698 }, // Houston, TX
  { zipcode: '77002', lat: 29.7633, lng: -95.3633 }, // Houston, TX
  { zipcode: '77003', lat: 29.7440, lng: -95.3466 }, // Houston, TX
  { zipcode: '78701', lat: 30.2672, lng: -97.7431 }, // Austin, TX
  { zipcode: '78702', lat: 30.2515, lng: -97.7323 }, // Austin, TX
  { zipcode: '78703', lat: 30.2711, lng: -97.7694 }, // Austin, TX
  { zipcode: '78704', lat: 30.2370, lng: -97.7595 }, // Austin, TX
  { zipcode: '78705', lat: 30.2849, lng: -97.7341 }, // Austin, TX
  { zipcode: '76101', lat: 32.7555, lng: -97.3308 }, // Fort Worth, TX
  { zipcode: '76102', lat: 32.7357, lng: -97.3547 }, // Fort Worth, TX
  { zipcode: '76103', lat: 32.7652, lng: -97.3595 }, // Fort Worth, TX
  { zipcode: '78201', lat: 29.4241, lng: -98.4936 }, // San Antonio, TX
  { zipcode: '78202', lat: 29.4450, lng: -98.4731 }, // San Antonio, TX
  { zipcode: '78203', lat: 29.3957, lng: -98.5226 }, // San Antonio, TX
  { zipcode: '78204', lat: 29.3813, lng: -98.5342 }, // San Antonio, TX
  { zipcode: '78205', lat: 29.4163, lng: -98.5014 }, // San Antonio, TX
];

// Point-in-polygon algorithm using ray casting
function isPointInPolygon(point: { lat: number; lng: number }, polygon: PolygonPoint[]): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

// Fallback function for centroid-based ZIP code lookup
async function findZipcodesWithCentroidFallback(polygon: PolygonPoint[]): Promise<string[]> {
  // Filter ZIP codes using point-in-polygon algorithm
  const zipcodesInPolygon = US_ZIPCODES.filter(zip => 
    isPointInPolygon({ lat: zip.lat, lng: zip.lng }, polygon)
  );
  
  const foundZipcodes = zipcodesInPolygon.map(zip => zip.zipcode);
  console.log(`Centroid fallback found ${foundZipcodes.length} ZIP codes:`, foundZipcodes);
  
  // If no ZIP codes found, try to suggest one based on polygon center
  if (foundZipcodes.length === 0) {
    const centroid = getPolygonCentroid(polygon);
    console.log('No ZIP codes found in polygon, checking centroid:', centroid);
    
    // Find closest ZIP code to centroid
    let closest = US_ZIPCODES[0];
    let minDistance = getDistance(centroid, { lat: closest.lat, lng: closest.lng });
    
    for (const zip of US_ZIPCODES) {
      const distance = getDistance(centroid, { lat: zip.lat, lng: zip.lng });
      if (distance < minDistance) {
        minDistance = distance;
        closest = zip;
      }
    }
    
    console.log(`Suggesting closest ZIP code: ${closest.zipcode} (${minDistance.toFixed(2)} miles away)`);
    return [closest.zipcode];
  }
  
  return foundZipcodes;
}

// Calculate polygon centroid
function getPolygonCentroid(polygon: PolygonPoint[]): PolygonPoint {
  let centroidLat = 0;
  let centroidLng = 0;
  
  for (const point of polygon) {
    centroidLat += point.lat;
    centroidLng += point.lng;
  }
  
  return {
    lat: centroidLat / polygon.length,
    lng: centroidLng / polygon.length
  };
}

// Calculate distance between two points in miles
function getDistance(point1: PolygonPoint, point2: PolygonPoint): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.split(' ')[1]);
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Check user permissions
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    if (userData.role !== 'admin' && userData.role !== 'worker') {
      throw new Error('Insufficient permissions');
    }

    // Parse request body first
    const requestBody: UpsertRequest = await req.json();

    // If worker, only allow self-assignment
    if (userData.role === 'worker' && user.id !== requestBody.workerId) {
      throw new Error('Workers can only manage their own service areas');
    }
    const { workerId, areaName, mode, polygon, zipcodesOnly } = requestBody;

    // Validate request
    if (!workerId || !areaName) {
      throw new Error('Worker ID and area name are required');
    }

    if (!polygon && !zipcodesOnly) {
      throw new Error('Either polygon or zipcodesOnly must be provided');
    }

    if (polygon && zipcodesOnly) {
      throw new Error('Cannot provide both polygon and zipcodesOnly');
    }

    // Verify worker exists
    const { data: workerData, error: workerError } = await supabase
      .from('users')
      .select('id')
      .eq('id', workerId)
      .eq('role', 'worker')
      .single();

    if (workerError || !workerData) {
      throw new Error('Worker not found');
    }

    let zipcodes: string[] = [];

    if (polygon) {
      // Direct PostGIS integration with fallback
      try {
        // First try PostGIS spatial query
        const { data: postgisResult, error: postgisError } = await supabase.rpc('find_zipcodes_intersecting_polygon', {
          polygon_coords: polygon
        });

        if (postgisError) {
          console.log('PostGIS query failed, using fallback:', postgisError);
        } else if (postgisResult && postgisResult.length > 0) {
          zipcodes = postgisResult;
          console.log(`PostGIS found ${zipcodes.length} ZIP codes`);
        }
      } catch (error) {
        console.log('PostGIS query error, using fallback:', error);
      }

      // Fallback to centroid-based lookup if PostGIS failed or returned no results
      if (zipcodes.length === 0) {
        console.log('Using centroid-based fallback for ZIP code lookup');
        zipcodes = await findZipcodesWithCentroidFallback(polygon);
      }
    } else if (zipcodesOnly) {
      zipcodes = zipcodesOnly;
    }

    // Remove duplicates and validate
    zipcodes = [...new Set(zipcodes.filter(zip => zip && zip.trim().length === 5))];

    if (zipcodes.length === 0) {
      throw new Error('No valid ZIP codes found');
    }

    // Safe atomic operation for replace_all mode
    let newArea: any;
    
    // Step 1: Create new service area first
    const { data: createdArea, error: areaError } = await supabase
      .from('worker_service_areas')
      .insert({
        worker_id: workerId,
        area_name: areaName,
        polygon_coordinates: polygon || [],
        is_active: true
      })
      .select()
      .single();

    if (areaError || !createdArea) {
      throw new Error(`Failed to create service area: ${areaError?.message}`);
    }

    newArea = createdArea;

    try {
      // Step 2: Insert new zipcodes
      const zipcodeInserts = zipcodes.map(zipcode => ({
        worker_id: workerId,
        service_area_id: newArea.id,
        zipcode
      }));

      const { error: zipcodesError } = await supabase
        .from('worker_service_zipcodes')
        .insert(zipcodeInserts);

      if (zipcodesError) {
        throw new Error(`Failed to insert zipcodes: ${zipcodesError.message}`);
      }

      // Step 3: Only after successful creation, handle replace_all cleanup
      if (mode === 'replace_all') {
        // Deactivate existing service areas for this worker (excluding the new one)
        const { error: deactivateError } = await supabase
          .from('worker_service_areas')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('worker_id', workerId)
          .eq('is_active', true)
          .neq('id', newArea.id);

        if (deactivateError) {
          throw new Error(`Failed to deactivate existing areas: ${deactivateError.message}`);
        }

        // Delete existing zipcodes for other areas of this worker
        const { error: deleteZipsError } = await supabase
          .from('worker_service_zipcodes')
          .delete()
          .eq('worker_id', workerId)
          .neq('service_area_id', newArea.id);

        if (deleteZipsError) {
          throw new Error(`Failed to delete existing zipcodes: ${deleteZipsError.message}`);
        }
      }

    } catch (error) {
      // Rollback: delete the newly created area and its zipcodes on failure
      await supabase
        .from('worker_service_zipcodes')
        .delete()
        .eq('service_area_id', newArea.id);
      
      await supabase
        .from('worker_service_areas')
        .delete()
        .eq('id', newArea.id);
      
      throw error;
    }

    // Create audit log
    const { error: auditError } = await supabase.rpc('create_service_area_audit_log', {
      p_worker_id: workerId,
      p_record_id: newArea.id,
      p_operation: mode === 'replace_all' ? 'upsert_replace' : 'upsert_append',
      p_table_name: 'worker_service_areas',
      p_new_data: {
        area_name: areaName,
        zipcode_count: zipcodes.length,
        mode
      },
      p_old_data: null,
      p_changed_by: user.id
    });

    if (auditError) {
      console.error('Audit log creation failed:', auditError);
      // Don't throw here as the main operation succeeded
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Service area '${areaName}' created with ${zipcodes.length} ZIP codes`,
        data: {
          area_id: newArea.id,
          zipcode_count: zipcodes.length,
          zipcodes
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Service area upsert error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});