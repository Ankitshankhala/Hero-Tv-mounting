import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PolygonPoint {
  lat: number;
  lng: number;
}

interface ZipcodeWithStatus {
  zipcode: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  status: 'assigned_to_worker' | 'assigned_to_other' | 'unassigned';
  assignedWorkerName?: string;
  assignedWorkerEmail?: string;
}

// Point in polygon algorithm
function isPointInPolygon(point: { lat: number; lng: number }, polygon: PolygonPoint[]): boolean {
  let inside = false;
  let j = polygon.length - 1;

  for (let i = 0; i < polygon.length; i++) {
    if (
      ((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
      (point.lng < ((polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat)) / (polygon[j].lat - polygon[i].lat) + polygon[i].lng)
    ) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Parse request body
    const { polygon, selectedWorkerId } = await req.json();

    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      throw new Error('Valid polygon coordinates required');
    }

    // Get requesting user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    console.log(`Admin ${user.email} querying ZIP codes in polygon for worker ${selectedWorkerId}`);

    // Get all ZIP codes within the polygon
    const { data: allZipcodes, error: zipError } = await supabase
      .from('us_zip_codes')
      .select('zipcode, latitude, longitude, city, state')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (zipError) {
      throw new Error(`Failed to fetch ZIP codes: ${zipError.message}`);
    }

    // Filter ZIP codes within polygon
    const zipcodesInPolygon = allZipcodes.filter(zip => 
      zip.latitude && zip.longitude && 
      isPointInPolygon({ lat: zip.latitude, lng: zip.longitude }, polygon)
    );

    console.log(`Found ${zipcodesInPolygon.length} ZIP codes within polygon`);

    // Get current assignments for these ZIP codes
    const zipcodesArray = zipcodesInPolygon.map(z => z.zipcode);
    
    const { data: assignments, error: assignError } = await supabase
      .from('worker_service_zipcodes')
      .select(`
        zipcode,
        worker_id,
        service_area_id,
        worker_service_areas!inner(is_active),
        users!worker_service_zipcodes_worker_id_fkey(name, email)
      `)
      .in('zipcode', zipcodesArray)
      .eq('worker_service_areas.is_active', true);

    if (assignError) {
      console.warn('Error fetching assignments:', assignError);
    }

    // Build status map
    const assignmentMap = new Map<string, { workerId: string; workerName: string; workerEmail: string }>();
    
    if (assignments) {
      assignments.forEach(assignment => {
        if (assignment.zipcode && assignment.worker_id) {
          assignmentMap.set(assignment.zipcode, {
            workerId: assignment.worker_id,
            workerName: assignment.users?.name || 'Unknown',
            workerEmail: assignment.users?.email || 'Unknown'
          });
        }
      });
    }

    // Classify ZIP codes by status
    const zipcodesWithStatus: ZipcodeWithStatus[] = zipcodesInPolygon.map(zip => {
      const assignment = assignmentMap.get(zip.zipcode);
      
      let status: ZipcodeWithStatus['status'];
      let assignedWorkerName: string | undefined;
      let assignedWorkerEmail: string | undefined;

      if (!assignment) {
        status = 'unassigned';
      } else if (assignment.workerId === selectedWorkerId) {
        status = 'assigned_to_worker';
        assignedWorkerName = assignment.workerName;
        assignedWorkerEmail = assignment.workerEmail;
      } else {
        status = 'assigned_to_other';
        assignedWorkerName = assignment.workerName;
        assignedWorkerEmail = assignment.workerEmail;
      }

      return {
        zipcode: zip.zipcode,
        lat: zip.latitude,
        lng: zip.longitude,
        city: zip.city,
        state: zip.state,
        status,
        assignedWorkerName,
        assignedWorkerEmail
      };
    });

    const summary = {
      total: zipcodesWithStatus.length,
      assigned_to_worker: zipcodesWithStatus.filter(z => z.status === 'assigned_to_worker').length,
      assigned_to_other: zipcodesWithStatus.filter(z => z.status === 'assigned_to_other').length,
      unassigned: zipcodesWithStatus.filter(z => z.status === 'unassigned').length
    };

    console.log(`ZIP summary: ${summary.total} total, ${summary.assigned_to_worker} assigned to worker, ${summary.assigned_to_other} assigned to others, ${summary.unassigned} unassigned`);

    return new Response(JSON.stringify({
      success: true,
      zipcodes: zipcodesWithStatus,
      summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('ZIP codes in area query error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});