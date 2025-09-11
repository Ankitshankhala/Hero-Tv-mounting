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
  areaIdToUpdate?: string; // For editing existing areas
}

// Enhanced US ZIP codes database with broader coverage
const US_ZIPCODES = [
  // Dallas, TX area
  { zipcode: '75201', lat: 32.7767, lng: -96.7970 }, { zipcode: '75202', lat: 32.7815, lng: -96.8047 },
  { zipcode: '75203', lat: 32.7668, lng: -96.7836 }, { zipcode: '75204', lat: 32.7880, lng: -96.7849 },
  { zipcode: '75205', lat: 32.8206, lng: -96.7869 }, { zipcode: '75206', lat: 32.8096, lng: -96.7516 },
  { zipcode: '75207', lat: 32.7516, lng: -96.8326 }, { zipcode: '75208', lat: 32.7434, lng: -96.8516 },
  { zipcode: '75209', lat: 32.8423, lng: -96.8103 }, { zipcode: '75210', lat: 32.7323, lng: -96.6877 },
  { zipcode: '75211', lat: 32.7126, lng: -96.8516 }, { zipcode: '75212', lat: 32.7712, lng: -96.8516 },
  { zipcode: '75214', lat: 32.7993, lng: -96.7336 }, { zipcode: '75215', lat: 32.7223, lng: -96.7516 },
  { zipcode: '75216', lat: 32.6990, lng: -96.8103 }, { zipcode: '75217', lat: 32.6990, lng: -96.6877 },
  { zipcode: '75218', lat: 32.8316, lng: -96.7516 }, { zipcode: '75219', lat: 32.7880, lng: -96.8103 },
  { zipcode: '75220', lat: 32.8423, lng: -96.8516 }, { zipcode: '75221', lat: 32.7880, lng: -96.7336 },
  { zipcode: '75222', lat: 32.7516, lng: -96.7516 }, { zipcode: '75223', lat: 32.7712, lng: -96.7103 },
  { zipcode: '75224', lat: 32.7223, lng: -96.7103 }, { zipcode: '75225', lat: 32.8206, lng: -96.8103 },
  { zipcode: '75226', lat: 32.7516, lng: -96.7103 }, { zipcode: '75227', lat: 32.6877, lng: -96.7103 },
  { zipcode: '75228', lat: 32.7323, lng: -96.6516 }, { zipcode: '75229', lat: 32.8740, lng: -96.8103 },
  { zipcode: '75230', lat: 32.8740, lng: -96.7516 }, { zipcode: '75231', lat: 32.8423, lng: -96.7103 },
  { zipcode: '75232', lat: 32.6877, lng: -96.7516 }, { zipcode: '75233', lat: 32.6877, lng: -96.8103 },
  { zipcode: '75234', lat: 32.9103, lng: -96.8103 }, { zipcode: '75235', lat: 32.7323, lng: -96.8103 },
  { zipcode: '75236', lat: 32.6516, lng: -96.7516 }, { zipcode: '75237', lat: 32.6516, lng: -96.8103 },
  { zipcode: '75238', lat: 32.8206, lng: -96.6877 }, { zipcode: '75240', lat: 32.9423, lng: -96.7516 },
  { zipcode: '75241', lat: 32.6877, lng: -96.6877 }, { zipcode: '75243', lat: 32.9103, lng: -96.7103 },
  { zipcode: '75244', lat: 32.9423, lng: -96.8103 }, { zipcode: '75246', lat: 32.7712, lng: -96.6877 },
  { zipcode: '75247', lat: 32.7712, lng: -96.8879 }, { zipcode: '75248', lat: 32.9740, lng: -96.7516 },
  { zipcode: '75249', lat: 32.6516, lng: -96.6877 }, { zipcode: '75251', lat: 32.9740, lng: -96.8103 },
  
  // Houston, TX area
  { zipcode: '77001', lat: 29.7604, lng: -95.3698 }, { zipcode: '77002', lat: 29.7633, lng: -95.3633 },
  { zipcode: '77003', lat: 29.7440, lng: -95.3466 }, { zipcode: '77004', lat: 29.7247, lng: -95.3927 },
  { zipcode: '77005', lat: 29.7180, lng: -95.4103 }, { zipcode: '77006', lat: 29.7440, lng: -95.3927 },
  { zipcode: '77007', lat: 29.7747, lng: -95.3927 }, { zipcode: '77008', lat: 29.8027, lng: -95.4103 },
  { zipcode: '77009', lat: 29.8027, lng: -95.3698 }, { zipcode: '77010', lat: 29.7247, lng: -95.3698 },
  { zipcode: '77011', lat: 29.7440, lng: -95.3103 }, { zipcode: '77012', lat: 29.7247, lng: -95.3103 },
  { zipcode: '77013', lat: 29.7633, lng: -95.2879 }, { zipcode: '77014', lat: 29.8423, lng: -95.3698 },
  { zipcode: '77015', lat: 29.7747, lng: -95.2516 }, { zipcode: '77016', lat: 29.8206, lng: -95.4516 },
  { zipcode: '77017', lat: 29.6990, lng: -95.3466 }, { zipcode: '77018', lat: 29.8206, lng: -95.3927 },
  { zipcode: '77019', lat: 29.7747, lng: -95.4516 }, { zipcode: '77020', lat: 29.7247, lng: -95.2879 },
  
  // Austin, TX area  
  { zipcode: '78701', lat: 30.2672, lng: -97.7431 }, { zipcode: '78702', lat: 30.2515, lng: -97.7323 },
  { zipcode: '78703', lat: 30.2711, lng: -97.7694 }, { zipcode: '78704', lat: 30.2370, lng: -97.7595 },
  { zipcode: '78705', lat: 30.2849, lng: -97.7341 }, { zipcode: '78712', lat: 30.2849, lng: -97.7431 },
  { zipcode: '78717', lat: 30.3880, lng: -97.8103 }, { zipcode: '78719', lat: 30.1323, lng: -97.7516 },
  { zipcode: '78721', lat: 30.2712, lng: -97.6877 }, { zipcode: '78722', lat: 30.2712, lng: -97.7103 },
  { zipcode: '78723', lat: 30.3103, lng: -97.6877 }, { zipcode: '78724', lat: 30.2323, lng: -97.6516 },
  { zipcode: '78725', lat: 30.1990, lng: -97.6877 }, { zipcode: '78726', lat: 30.4423, lng: -97.8516 },
  { zipcode: '78727', lat: 30.4103, lng: -97.7516 }, { zipcode: '78728', lat: 30.1323, lng: -97.8103 },
  { zipcode: '78729', lat: 30.4103, lng: -97.8103 }, { zipcode: '78730', lat: 30.3516, lng: -97.8516 },
  { zipcode: '78731', lat: 30.3516, lng: -97.7879 }, { zipcode: '78732', lat: 30.3516, lng: -97.9103 },
  { zipcode: '78733', lat: 30.3103, lng: -97.9516 }, { zipcode: '78734', lat: 30.2712, lng: -97.9516 },
  { zipcode: '78735', lat: 30.2323, lng: -97.8879 }, { zipcode: '78736', lat: 30.2712, lng: -97.8516 },
  { zipcode: '78737', lat: 30.1990, lng: -97.8879 }, { zipcode: '78738', lat: 30.2323, lng: -97.9516 },
  { zipcode: '78739', lat: 30.1516, lng: -97.8516 }, { zipcode: '78741', lat: 30.2323, lng: -97.7103 },
  { zipcode: '78742', lat: 30.1990, lng: -97.7103 }, { zipcode: '78744', lat: 30.1516, lng: -97.7516 },
  { zipcode: '78745', lat: 30.1516, lng: -97.7879 }, { zipcode: '78746', lat: 30.2323, lng: -97.8103 },
  { zipcode: '78747', lat: 30.1516, lng: -97.8103 }, { zipcode: '78748', lat: 30.1990, lng: -97.8516 },
  { zipcode: '78749', lat: 30.1516, lng: -97.8879 }, { zipcode: '78750', lat: 30.3880, lng: -97.7879 },
  { zipcode: '78751', lat: 30.3103, lng: -97.7103 }, { zipcode: '78752', lat: 30.3103, lng: -97.6516 },
  { zipcode: '78753', lat: 30.3516, lng: -97.6877 }, { zipcode: '78754', lat: 30.3516, lng: -97.6516 },
  { zipcode: '78756', lat: 30.3516, lng: -97.7516 }, { zipcode: '78757', lat: 30.3880, lng: -97.7516 },
  { zipcode: '78758', lat: 30.4423, lng: -97.6877 }, { zipcode: '78759', lat: 30.4103, lng: -97.7103 },
  
  // Fort Worth, TX area
  { zipcode: '76101', lat: 32.7555, lng: -97.3308 }, { zipcode: '76102', lat: 32.7357, lng: -97.3547 },
  { zipcode: '76103', lat: 32.7652, lng: -97.3595 }, { zipcode: '76104', lat: 32.7103, lng: -97.3516 },
  { zipcode: '76105', lat: 32.6877, lng: -97.3103 }, { zipcode: '76106', lat: 32.7323, lng: -97.3879 },
  { zipcode: '76107', lat: 32.7712, lng: -97.3879 }, { zipcode: '76108', lat: 32.6516, lng: -97.3516 },
  { zipcode: '76109', lat: 32.7712, lng: -97.4103 }, { zipcode: '76110', lat: 32.7323, lng: -97.4516 },
  { zipcode: '76111', lat: 32.7712, lng: -97.2879 }, { zipcode: '76112', lat: 32.7323, lng: -97.2516 },
  { zipcode: '76114', lat: 32.6877, lng: -97.3879 }, { zipcode: '76115', lat: 32.6516, lng: -97.4103 },
  { zipcode: '76116', lat: 32.6877, lng: -97.4516 }, { zipcode: '76117', lat: 32.8103, lng: -97.4103 },
  { zipcode: '76118', lat: 32.6516, lng: -97.2879 }, { zipcode: '76119', lat: 32.6516, lng: -97.3103 },
  { zipcode: '76120', lat: 32.6103, lng: -97.3516 }, { zipcode: '76123', lat: 32.6103, lng: -97.4103 },
  { zipcode: '76131', lat: 32.8103, lng: -97.3516 }, { zipcode: '76132', lat: 32.8423, lng: -97.4103 },
  { zipcode: '76133', lat: 32.8103, lng: -97.2879 }, { zipcode: '76134', lat: 32.6103, lng: -97.2879 },
  { zipcode: '76135', lat: 32.8740, lng: -97.4516 }, { zipcode: '76137', lat: 32.8740, lng: -97.3103 },
  { zipcode: '76140', lat: 32.5740, lng: -97.3879 }, { zipcode: '76148', lat: 32.8740, lng: -97.2516 },
  
  // San Antonio, TX area
  { zipcode: '78201', lat: 29.4241, lng: -98.4936 }, { zipcode: '78202', lat: 29.4450, lng: -98.4731 },
  { zipcode: '78203', lat: 29.3957, lng: -98.5226 }, { zipcode: '78204', lat: 29.3813, lng: -98.5342 },
  { zipcode: '78205', lat: 29.4163, lng: -98.5014 }, { zipcode: '78207', lat: 29.4516, lng: -98.5516 },
  { zipcode: '78208', lat: 29.5103, lng: -98.4516 }, { zipcode: '78209', lat: 29.4879, lng: -98.4516 },
  { zipcode: '78210', lat: 29.3516, lng: -98.5516 }, { zipcode: '78211', lat: 29.3516, lng: -98.4879 },
  { zipcode: '78212', lat: 29.4879, lng: -98.4879 }, { zipcode: '78213', lat: 29.5516, lng: -98.4879 },
  { zipcode: '78214', lat: 29.3103, lng: -98.5516 }, { zipcode: '78215', lat: 29.4516, lng: -98.4103 },
  { zipcode: '78216', lat: 29.5516, lng: -98.4516 }, { zipcode: '78217', lat: 29.5879, lng: -98.4879 },
  { zipcode: '78218', lat: 29.5103, lng: -98.3879 }, { zipcode: '78219', lat: 29.4103, lng: -98.4103 },
  { zipcode: '78220', lat: 29.3516, lng: -98.4103 }, { zipcode: '78221', lat: 29.3103, lng: -98.4516 },
  { zipcode: '78222', lat: 29.3516, lng: -98.3879 }, { zipcode: '78223', lat: 29.2879, lng: -98.4516 },
  { zipcode: '78224', lat: 29.2879, lng: -98.5103 }, { zipcode: '78225', lat: 29.2516, lng: -98.5516 },
  { zipcode: '78226', lat: 29.2516, lng: -98.4879 }, { zipcode: '78227', lat: 29.2879, lng: -98.5879 },
  { zipcode: '78228', lat: 29.3103, lng: -98.6103 }, { zipcode: '78229', lat: 29.5103, lng: -98.5516 },
  { zipcode: '78230', lat: 29.5879, lng: -98.5516 }, { zipcode: '78231', lat: 29.5516, lng: -98.4103 },
  { zipcode: '78232', lat: 29.6103, lng: -98.4516 }, { zipcode: '78233', lat: 29.4879, lng: -98.3516 },
  { zipcode: '78234', lat: 29.5516, lng: -98.3516 }, { zipcode: '78235', lat: 29.6103, lng: -98.5103 },
  { zipcode: '78236', lat: 29.2516, lng: -98.4103 }, { zipcode: '78237', lat: 29.2103, lng: -98.5103 },
  { zipcode: '78238', lat: 29.6516, lng: -98.4879 }, { zipcode: '78239', lat: 29.4103, lng: -98.3516 },
  { zipcode: '78240', lat: 29.6103, lng: -98.5516 }, { zipcode: '78242', lat: 29.3516, lng: -98.3516 },
  { zipcode: '78244', lat: 29.2879, lng: -98.3879 }, { zipcode: '78245', lat: 29.2516, lng: -98.6516 },
  { zipcode: '78247', lat: 29.6103, lng: -98.3879 }, { zipcode: '78248', lat: 29.6516, lng: -98.4103 },
  { zipcode: '78249', lat: 29.6516, lng: -98.5516 }, { zipcode: '78250', lat: 29.6103, lng: -98.6103 },
  { zipcode: '78251', lat: 29.5516, lng: -98.6103 }, { zipcode: '78252', lat: 29.6879, lng: -98.4516 },
  { zipcode: '78253', lat: 29.6516, lng: -98.6103 }, { zipcode: '78254', lat: 29.5879, lng: -98.6516 },
  { zipcode: '78255', lat: 29.7103, lng: -98.5103 }, { zipcode: '78256', lat: 29.7103, lng: -98.4516 },
  { zipcode: '78257', lat: 29.7516, lng: -98.4879 }, { zipcode: '78258', lat: 29.6879, lng: -98.3879 },
  { zipcode: '78259', lat: 29.7516, lng: -98.5516 }
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

// Enhanced fallback function with bounding box and point-in-polygon filtering
async function findZipcodesWithCentroidFallback(polygon: PolygonPoint[], supabase: any): Promise<string[]> {
  console.log('Using enhanced fallback ZIP lookup...');
  
  // Step 1: Calculate polygon bounding box
  const minLat = Math.min(...polygon.map(p => p.lat));
  const maxLat = Math.max(...polygon.map(p => p.lat));
  const minLng = Math.min(...polygon.map(p => p.lng));
  const maxLng = Math.max(...polygon.map(p => p.lng));
  
  console.log(`Polygon bounds: lat(${minLat.toFixed(4)} to ${maxLat.toFixed(4)}), lng(${minLng.toFixed(4)} to ${maxLng.toFixed(4)})`);
  
  // Step 2: Query us_zip_codes table for ZIP codes within bounding box
  let databaseZips: any[] = [];
  try {
    const { data: zipData, error: zipError } = await supabase
      .from('us_zip_codes')
      .select('zipcode, latitude, longitude')
      .gte('latitude', minLat - 0.1)  // Add small buffer
      .lte('latitude', maxLat + 0.1)
      .gte('longitude', minLng - 0.1)
      .lte('longitude', maxLng + 0.1);
    
    if (!zipError && zipData && zipData.length > 0) {
      databaseZips = zipData.map(z => ({
        zipcode: z.zipcode,
        lat: parseFloat(z.latitude),
        lng: parseFloat(z.longitude)
      }));
      console.log(`Found ${databaseZips.length} ZIP codes in database within bounding box`);
    } else {
      console.log('Database query failed or returned no results, using fallback data');
    }
  } catch (error) {
    console.log('Database ZIP lookup failed:', error);
  }
  
  // Step 3: Use database zips if available, otherwise fallback to hardcoded list
  const zipDatabase = databaseZips.length > 0 ? databaseZips : US_ZIPCODES;
  
  // Step 4: Filter ZIP codes using point-in-polygon algorithm
  const zipcodesInPolygon = zipDatabase.filter(zip => 
    isPointInPolygon({ lat: zip.lat, lng: zip.lng }, polygon)
  );
  
  const foundZipcodes = zipcodesInPolygon.map(zip => zip.zipcode);
  console.log(`Point-in-polygon found ${foundZipcodes.length} ZIP codes:`, foundZipcodes.slice(0, 10), foundZipcodes.length > 10 ? '...' : '');
  
  // Step 5: If no ZIP codes found inside polygon, find nearby ones
  if (foundZipcodes.length === 0) {
    const centroid = getPolygonCentroid(polygon);
    console.log('No ZIP codes found in polygon, finding nearest to centroid:', centroid);
    
    // Find closest ZIP codes to centroid (return top 3)
    const distances = zipDatabase.map(zip => ({
      zipcode: zip.zipcode,
      distance: getDistance(centroid, { lat: zip.lat, lng: zip.lng })
    })).sort((a, b) => a.distance - b.distance);
    
    const nearestZips = distances.slice(0, 3).map(d => d.zipcode);
    console.log(`Suggesting ${nearestZips.length} nearest ZIP codes:`, nearestZips);
    return nearestZips;
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
    const { workerId, areaName, mode, polygon, zipcodesOnly, areaIdToUpdate } = requestBody;

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

      // Fallback to enhanced lookup if PostGIS failed or returned no results
      if (zipcodes.length === 0) {
        console.log('Using enhanced fallback for ZIP code lookup');
        zipcodes = await findZipcodesWithCentroidFallback(polygon, supabase);
      }
    } else if (zipcodesOnly) {
      zipcodes = zipcodesOnly;
    }

    // Remove duplicates and validate
    zipcodes = [...new Set(zipcodes.filter(zip => zip && zip.trim().length === 5))];

    if (zipcodes.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No valid ZIP codes found in the selected area',
          suggestManualMode: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 for business logic errors
        }
      );
    }

    let newArea: any;
    let existingZips: string[] = [];
    
    // Handle editing existing area
    if (areaIdToUpdate) {
      // Verify area belongs to worker
      const { data: existingArea, error: areaError } = await supabase
        .from('worker_service_areas')
        .select('*')
        .eq('id', areaIdToUpdate)
        .eq('worker_id', workerId)
        .single();

      if (areaError || !existingArea) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Service area not found or access denied'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Update existing area
      const { data: updatedArea, error: updateError } = await supabase
        .from('worker_service_areas')
        .update({
          area_name: areaName,
          polygon_coordinates: polygon || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', areaIdToUpdate)
        .select()
        .single();

      if (updateError || !updatedArea) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to update service area: ${updateError?.message}`
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Delete old ZIP codes for this area
      await supabase
        .from('worker_service_zipcodes')
        .delete()
        .eq('service_area_id', areaIdToUpdate);

      newArea = updatedArea;
    } else {
      // Get existing ZIP codes for append mode
      if (mode === 'append') {
        const { data: existingZipData } = await supabase
          .from('worker_service_zipcodes')
          .select('zipcode')
          .eq('worker_id', workerId);
        
        existingZips = existingZipData?.map(z => z.zipcode) || [];
      }
      
      // Create new service area
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
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to create service area: ${areaError?.message}`
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      newArea = createdArea;
    }

    try {
      // Insert ZIP codes (skip duplicates in append mode)
      let zipcodesToInsert = zipcodes;
      let skippedCount = 0;
      
      if (mode === 'append' && !areaIdToUpdate) {
        zipcodesToInsert = zipcodes.filter(zip => !existingZips.includes(zip));
        skippedCount = zipcodes.length - zipcodesToInsert.length;
        console.log(`Append mode: ${zipcodesToInsert.length} new ZIPs, ${skippedCount} duplicates skipped`);
      }

      if (zipcodesToInsert.length > 0) {
        const zipcodeInserts = zipcodesToInsert.map(zipcode => ({
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
      }

      // Handle replace_all cleanup (only for new areas, not edits)
      if (mode === 'replace_all' && !areaIdToUpdate) {
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
      // Rollback: delete the newly created area and its zipcodes on failure (only for new areas)
      if (!areaIdToUpdate) {
        await supabase
          .from('worker_service_zipcodes')
          .delete()
          .eq('service_area_id', newArea.id);
        
        await supabase
          .from('worker_service_areas')
          .delete()
          .eq('id', newArea.id);
      }
      
      throw error;
    }

    // Create audit log
    const operation = areaIdToUpdate ? 'update' : (mode === 'replace_all' ? 'upsert_replace' : 'upsert_append');
    const { error: auditError } = await supabase.rpc('create_service_area_audit_log', {
      p_worker_id: workerId,
      p_record_id: newArea.id,
      p_operation: operation,
      p_table_name: 'worker_service_areas',
      p_new_data: {
        area_name: areaName,
        zipcode_count: zipcodesToInsert?.length || zipcodes.length,
        mode: areaIdToUpdate ? 'edit' : mode,
        skipped_duplicates: skippedCount || 0
      },
      p_old_data: null,
      p_changed_by: user.id
    });

    if (auditError) {
      console.error('Audit log creation failed:', auditError);
      // Don't throw here as the main operation succeeded
    }

    const finalZipCount = zipcodesToInsert?.length || zipcodes.length;
    const actionText = areaIdToUpdate ? 'updated' : 'created';
    
    let message = `Service area '${areaName}' ${actionText} with ${finalZipCount} ZIP codes`;
    if (skippedCount > 0) {
      message += ` (${skippedCount} duplicates skipped)`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message,
        data: {
          area_id: newArea.id,
          zipcode_count: finalZipCount,
          zipcodes: zipcodesToInsert || zipcodes,
          skipped_count: skippedCount || 0,
          operation: areaIdToUpdate ? 'updated' : 'created'
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
        status: 200, // Return 200 for business logic errors
      }
    );
  }
});