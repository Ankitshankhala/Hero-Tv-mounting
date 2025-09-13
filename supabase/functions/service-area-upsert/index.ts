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

// Expanded US ZIP codes with their latitude and longitude
// Covers major metropolitan areas across the US for better polygon coverage
const US_ZIPCODES = [
  // Dallas-Fort Worth, TX (expanded)
  { zipcode: "75201", lat: 32.7767, lng: -96.7970 }, { zipcode: "75202", lat: 32.7767, lng: -96.7970 },
  { zipcode: "75203", lat: 32.7555, lng: -96.7438 }, { zipcode: "75204", lat: 32.8045, lng: -96.7875 },
  { zipcode: "75205", lat: 32.8317, lng: -96.7942 }, { zipcode: "75206", lat: 32.7889, lng: -96.7542 },
  { zipcode: "75207", lat: 32.7722, lng: -96.8181 }, { zipcode: "75208", lat: 32.7403, lng: -96.8361 },
  { zipcode: "75209", lat: 32.8403, lng: -96.8181 }, { zipcode: "75210", lat: 32.7325, lng: -96.6825 },
  { zipcode: "75211", lat: 32.7542, lng: -96.8361 }, { zipcode: "75212", lat: 32.7944, lng: -96.8319 },
  { zipcode: "75214", lat: 32.7722, lng: -96.7181 }, { zipcode: "75215", lat: 32.7542, lng: -96.7361 },
  { zipcode: "75216", lat: 32.7325, lng: -96.7625 }, { zipcode: "75217", lat: 32.7014, lng: -96.7453 },
  { zipcode: "75218", lat: 32.8153, lng: -96.7014 }, { zipcode: "75219", lat: 32.7931, lng: -96.8097 },
  { zipcode: "75220", lat: 32.8542, lng: -96.8361 }, { zipcode: "75221", lat: 32.7542, lng: -96.7181 },
  { zipcode: "75222", lat: 32.7767, lng: -96.7970 }, { zipcode: "75223", lat: 32.7722, lng: -96.7542 },
  { zipcode: "75224", lat: 32.7325, lng: -96.7014 }, { zipcode: "75225", lat: 32.8403, lng: -96.7875 },
  { zipcode: "75226", lat: 32.7889, lng: -96.7361 }, { zipcode: "75227", lat: 32.7014, lng: -96.7181 },
  { zipcode: "75228", lat: 32.7542, lng: -96.6825 }, { zipcode: "75229", lat: 32.8542, lng: -96.7875 },
  { zipcode: "75230", lat: 32.8653, lng: -96.7778 }, { zipcode: "75231", lat: 32.7944, lng: -96.7319 },
  { zipcode: "75232", lat: 32.6903, lng: -96.7453 }, { zipcode: "75233", lat: 32.7222, lng: -96.7542 },
  { zipcode: "75234", lat: 32.8542, lng: -96.7542 }, { zipcode: "75235", lat: 32.7667, lng: -96.8278 },
  { zipcode: "75236", lat: 32.6903, lng: -96.7014 }, { zipcode: "75237", lat: 32.6903, lng: -96.7875 },
  { zipcode: "75238", lat: 32.7944, lng: -96.6825 }, { zipcode: "75240", lat: 32.9264, lng: -96.8278 },
  { zipcode: "75241", lat: 32.7125, lng: -96.7014 }, { zipcode: "75243", lat: 32.8153, lng: -96.6825 },
  { zipcode: "75244", lat: 32.9264, lng: -96.7319 }, { zipcode: "75246", lat: 32.7889, lng: -96.7181 },
  { zipcode: "75247", lat: 32.7667, lng: -96.8542 }, { zipcode: "75248", lat: 32.9264, lng: -96.7778 },
  { zipcode: "75249", lat: 32.7667, lng: -96.8097 }, { zipcode: "75251", lat: 32.9264, lng: -96.8097 },
  { zipcode: "75252", lat: 32.9486, lng: -96.8278 }, { zipcode: "75253", lat: 32.7667, lng: -96.7875 },
  { zipcode: "75254", lat: 32.9264, lng: -96.7542 }, { zipcode: "75287", lat: 32.9597, lng: -96.8542 },

  // Houston, TX (expanded)
  { zipcode: "77001", lat: 29.7604, lng: -95.3698 }, { zipcode: "77002", lat: 29.7514, lng: -95.3624 },
  { zipcode: "77003", lat: 29.7414, lng: -95.3524 }, { zipcode: "77004", lat: 29.7314, lng: -95.3424 },
  { zipcode: "77005", lat: 29.7214, lng: -95.3324 }, { zipcode: "77006", lat: 29.7514, lng: -95.3824 },
  { zipcode: "77007", lat: 29.7814, lng: -95.3924 }, { zipcode: "77008", lat: 29.8014, lng: -95.4024 },
  { zipcode: "77009", lat: 29.8114, lng: -95.3824 }, { zipcode: "77010", lat: 29.7314, lng: -95.3624 },
  { zipcode: "77011", lat: 29.7214, lng: -95.3124 }, { zipcode: "77012", lat: 29.7014, lng: -95.3024 },
  { zipcode: "77013", lat: 29.7114, lng: -95.2824 }, { zipcode: "77014", lat: 29.8614, lng: -95.3324 },
  { zipcode: "77015", lat: 29.7014, lng: -95.2524 }, { zipcode: "77016", lat: 29.8214, lng: -95.4124 },
  { zipcode: "77017", lat: 29.6814, lng: -95.2824 }, { zipcode: "77018", lat: 29.8114, lng: -95.4224 },
  { zipcode: "77019", lat: 29.7614, lng: -95.4124 }, { zipcode: "77020", lat: 29.7314, lng: -95.3024 },
  { zipcode: "77021", lat: 29.6914, lng: -95.3324 }, { zipcode: "77022", lat: 29.8014, lng: -95.3524 },
  { zipcode: "77023", lat: 29.7214, lng: -95.2924 }, { zipcode: "77024", lat: 29.7714, lng: -95.4324 },
  { zipcode: "77025", lat: 29.7014, lng: -95.3724 }, { zipcode: "77026", lat: 29.8214, lng: -95.3724 },
  { zipcode: "77027", lat: 29.7414, lng: -95.3924 }, { zipcode: "77028", lat: 29.8314, lng: -95.3424 },
  { zipcode: "77029", lat: 29.7014, lng: -95.2724 }, { zipcode: "77030", lat: 29.7064, lng: -95.3924 },
  { zipcode: "77031", lat: 29.6714, lng: -95.4124 }, { zipcode: "77032", lat: 29.8714, lng: -95.3624 },
  { zipcode: "77033", lat: 29.6814, lng: -95.2424 }, { zipcode: "77034", lat: 29.6614, lng: -95.2324 },

  // Austin, TX (expanded)
  { zipcode: "78701", lat: 30.2672, lng: -97.7431 }, { zipcode: "78702", lat: 30.2572, lng: -97.7231 },
  { zipcode: "78703", lat: 30.2772, lng: -97.7631 }, { zipcode: "78704", lat: 30.2472, lng: -97.7531 },
  { zipcode: "78705", lat: 30.2872, lng: -97.7331 }, { zipcode: "78712", lat: 30.2864, lng: -97.7394 },
  { zipcode: "78717", lat: 30.3833, lng: -97.8431 }, { zipcode: "78719", lat: 30.1833, lng: -97.7731 },
  { zipcode: "78721", lat: 30.2597, lng: -97.7097 }, { zipcode: "78722", lat: 30.2789, lng: -97.7131 },
  { zipcode: "78723", lat: 30.2972, lng: -97.6831 }, { zipcode: "78724", lat: 30.2372, lng: -97.6831 },
  { zipcode: "78725", lat: 30.2172, lng: -97.6431 }, { zipcode: "78726", lat: 30.4072, lng: -97.7431 },
  { zipcode: "78727", lat: 30.3672, lng: -97.7631 }, { zipcode: "78728", lat: 30.1772, lng: -97.8031 },
  { zipcode: "78729", lat: 30.3972, lng: -97.8031 }, { zipcode: "78730", lat: 30.3772, lng: -97.8331 },
  { zipcode: "78731", lat: 30.3372, lng: -97.7531 }, { zipcode: "78732", lat: 30.2872, lng: -97.8831 },
  { zipcode: "78733", lat: 30.2672, lng: -97.9031 }, { zipcode: "78734", lat: 30.2872, lng: -97.9231 },
  { zipcode: "78735", lat: 30.2172, lng: -97.8831 }, { zipcode: "78736", lat: 30.2272, lng: -97.9131 },
  { zipcode: "78737", lat: 30.1872, lng: -97.8631 }, { zipcode: "78738", lat: 30.2772, lng: -97.9531 },
  { zipcode: "78739", lat: 30.1472, lng: -97.8231 }, { zipcode: "78741", lat: 30.2272, lng: -97.7031 },
  { zipcode: "78742", lat: 30.2072, lng: -97.6831 }, { zipcode: "78744", lat: 30.1672, lng: -97.7431 },
  { zipcode: "78745", lat: 30.1772, lng: -97.7931 }, { zipcode: "78746", lat: 30.2772, lng: -97.8631 },
  { zipcode: "78747", lat: 30.1572, lng: -97.8031 }, { zipcode: "78748", lat: 30.1472, lng: -97.7731 },
  { zipcode: "78749", lat: 30.1772, lng: -97.8431 }, { zipcode: "78750", lat: 30.3972, lng: -97.7831 },
  { zipcode: "78751", lat: 30.3172, lng: -97.7131 }, { zipcode: "78752", lat: 30.3072, lng: -97.6931 },
  { zipcode: "78753", lat: 30.3272, lng: -97.6731 }, { zipcode: "78754", lat: 30.3472, lng: -97.6631 },
  { zipcode: "78756", lat: 30.3272, lng: -97.7431 }, { zipcode: "78757", lat: 30.3372, lng: -97.7131 },
  { zipcode: "78758", lat: 30.3772, lng: -97.6831 }, { zipcode: "78759", lat: 30.3672, lng: -97.7031 },

  // Fort Worth, TX (expanded)
  { zipcode: "76101", lat: 32.7555, lng: -97.3308 }, { zipcode: "76102", lat: 32.7455, lng: -97.3208 },
  { zipcode: "76103", lat: 32.7355, lng: -97.3108 }, { zipcode: "76104", lat: 32.7255, lng: -97.3008 },
  { zipcode: "76105", lat: 32.7155, lng: -97.2908 }, { zipcode: "76106", lat: 32.7242, lng: -97.3583 },
  { zipcode: "76107", lat: 32.7453, lng: -97.3583 }, { zipcode: "76108", lat: 32.6781, lng: -97.4031 },
  { zipcode: "76109", lat: 32.7675, lng: -97.3583 }, { zipcode: "76110", lat: 32.7047, lng: -97.4028 },
  { zipcode: "76111", lat: 32.7983, lng: -97.3833 }, { zipcode: "76112", lat: 32.7492, lng: -97.2383 },
  { zipcode: "76114", lat: 32.6958, lng: -97.3833 }, { zipcode: "76115", lat: 32.6681, lng: -97.3183 },
  { zipcode: "76116", lat: 32.6958, lng: -97.4533 }, { zipcode: "76117", lat: 32.8103, lng: -97.4283 },
  { zipcode: "76118", lat: 32.7492, lng: -97.4283 }, { zipcode: "76119", lat: 32.6847, lng: -97.2683 },
  { zipcode: "76120", lat: 32.6569, lng: -97.3433 }, { zipcode: "76121", lat: 32.6847, lng: -97.3833 },
  { zipcode: "76122", lat: 32.6958, lng: -97.4533 }, { zipcode: "76123", lat: 32.6458, lng: -97.3683 },
  { zipcode: "76126", lat: 32.6236, lng: -97.4533 }, { zipcode: "76127", lat: 32.7675, lng: -97.4533 },
  { zipcode: "76129", lat: 32.8103, lng: -97.4533 }, { zipcode: "76131", lat: 32.8325, lng: -97.4033 },
  { zipcode: "76132", lat: 32.8214, lng: -97.4783 }, { zipcode: "76133", lat: 32.7575, lng: -97.4783 },
  { zipcode: "76134", lat: 32.6958, lng: -97.4783 }, { zipcode: "76135", lat: 32.7242, lng: -97.5183 },
  { zipcode: "76137", lat: 32.8325, lng: -97.4533 }, { zipcode: "76140", lat: 32.6236, lng: -97.3433 },
  { zipcode: "76148", lat: 32.8603, lng: -97.3583 }, { zipcode: "76177", lat: 32.9036, lng: -97.4533 },

  // San Antonio, TX (expanded)
  { zipcode: "78201", lat: 29.4241, lng: -98.4936 }, { zipcode: "78202", lat: 29.4341, lng: -98.4836 },
  { zipcode: "78203", lat: 29.4141, lng: -98.5036 }, { zipcode: "78204", lat: 29.4041, lng: -98.5136 },
  { zipcode: "78205", lat: 29.3941, lng: -98.5236 }, { zipcode: "78207", lat: 29.4541, lng: -98.5336 },
  { zipcode: "78208", lat: 29.4641, lng: -98.4736 }, { zipcode: "78209", lat: 29.4341, lng: -98.4536 },
  { zipcode: "78210", lat: 29.3941, lng: -98.4536 }, { zipcode: "78211", lat: 29.3841, lng: -98.4436 },
  { zipcode: "78212", lat: 29.4641, lng: -98.4636 }, { zipcode: "78213", lat: 29.4741, lng: -98.5236 },
  { zipcode: "78214", lat: 29.3541, lng: -98.5436 }, { zipcode: "78215", lat: 29.4141, lng: -98.4336 },
  { zipcode: "78216", lat: 29.4841, lng: -98.4636 }, { zipcode: "78217", lat: 29.5041, lng: -98.4436 },
  { zipcode: "78218", lat: 29.4941, lng: -98.4236 }, { zipcode: "78219", lat: 29.4441, lng: -98.4036 },
  { zipcode: "78220", lat: 29.4241, lng: -98.3836 }, { zipcode: "78221", lat: 29.3741, lng: -98.4936 },
  { zipcode: "78222", lat: 29.3541, lng: -98.4136 }, { zipcode: "78223", lat: 29.3441, lng: -98.4536 },
  { zipcode: "78224", lat: 29.3041, lng: -98.4536 }, { zipcode: "78225", lat: 29.3241, lng: -98.5236 },
  { zipcode: "78226", lat: 29.3841, lng: -98.5636 }, { zipcode: "78227", lat: 29.4041, lng: -98.5836 },
  { zipcode: "78228", lat: 29.4441, lng: -98.5636 }, { zipcode: "78229", lat: 29.5141, lng: -98.4836 },
  { zipcode: "78230", lat: 29.5341, lng: -98.4636 }, { zipcode: "78231", lat: 29.5241, lng: -98.4336 },
  { zipcode: "78232", lat: 29.5441, lng: -98.4436 }, { zipcode: "78233", lat: 29.5641, lng: -98.4636 },
  { zipcode: "78234", lat: 29.5741, lng: -98.4836 }, { zipcode: "78235", lat: 29.4141, lng: -98.6036 },
  { zipcode: "78236", lat: 29.3541, lng: -98.6236 }, { zipcode: "78237", lat: 29.3341, lng: -98.5836 },
  { zipcode: "78238", lat: 29.4841, lng: -98.6036 }, { zipcode: "78239", lat: 29.4541, lng: -98.3836 },
  { zipcode: "78240", lat: 29.5541, lng: -98.5236 }, { zipcode: "78242", lat: 29.3141, lng: -98.3836 },
  { zipcode: "78244", lat: 29.3741, lng: -98.3336 }, { zipcode: "78245", lat: 29.4241, lng: -98.6236 },
  { zipcode: "78247", lat: 29.5541, lng: -98.4236 }, { zipcode: "78248", lat: 29.5841, lng: -98.4536 },
  { zipcode: "78249", lat: 29.5341, lng: -98.4036 }, { zipcode: "78250", lat: 29.5041, lng: -98.5536 },
  { zipcode: "78251", lat: 29.4741, lng: -98.6036 }, { zipcode: "78252", lat: 29.5741, lng: -98.5036 },
  { zipcode: "78253", lat: 29.5941, lng: -98.5536 }, { zipcode: "78254", lat: 29.5641, lng: -98.5836 },
  { zipcode: "78255", lat: 29.6041, lng: -98.5336 }, { zipcode: "78256", lat: 29.6141, lng: -98.4836 },
  { zipcode: "78257", lat: 29.6241, lng: -98.4436 }, { zipcode: "78258", lat: 29.6041, lng: -98.4036 },
  { zipcode: "78259", lat: 29.5841, lng: -98.3836 }, { zipcode: "78260", lat: 29.6341, lng: -98.4636 },
  { zipcode: "78261", lat: 29.6641, lng: -98.4236 }, { zipcode: "78263", lat: 29.5241, lng: -98.3636 },
  { zipcode: "78264", lat: 29.6541, lng: -98.3836 }, { zipcode: "78266", lat: 29.6741, lng: -98.4836 },
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
    
    // Find closest ZIP codes to centroid (return top 5)
    const distances = zipDatabase.map(zip => ({
      zipcode: zip.zipcode,
      distance: getDistance(centroid, { lat: zip.lat, lng: zip.lng })
    })).sort((a, b) => a.distance - b.distance);
    
    const nearestZips = distances.slice(0, 5).map(d => d.zipcode);
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

// Enhanced ZIP code synchronization function
async function synchronizeZipcodes(
  supabase: any,
  workerId: string,
  newZipcodes: string[],
  areaId: string,
  source: 'polygon' | 'manual',
  mode: 'replace_all' | 'append'
): Promise<{ inserted: number; updated: number; skipped: number; conflicts: any[] }> {
  console.log(`Synchronizing ${newZipcodes.length} ZIP codes from ${source} source for area ${areaId}`);
  
  const conflicts: any[] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const zipcode of newZipcodes) {
    try {
      // Check if ZIP already exists for this worker
      const { data: existingZip, error: checkError } = await supabase
        .from('worker_service_zipcodes')
        .select('*')
        .eq('worker_id', workerId)
        .eq('zipcode', zipcode)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`Error checking existing ZIP ${zipcode}:`, checkError);
        continue;
      }

      if (existingZip) {
        // ZIP exists - update flags intelligently
        const newFlags = {
          from_manual: source === 'manual' || existingZip.from_manual,
          from_polygon: source === 'polygon' || existingZip.from_polygon,
          service_area_id: areaId // Update to current area
        };

        const { error: updateError } = await supabase
          .from('worker_service_zipcodes')
          .update(newFlags)
          .eq('worker_id', workerId)
          .eq('zipcode', zipcode);

        if (updateError) {
          console.error(`Error updating ZIP ${zipcode}:`, updateError);
          conflicts.push({ zipcode, error: updateError.message });
        } else {
          updated++;
          console.log(`Updated ZIP ${zipcode} with flags:`, newFlags);
        }
      } else {
        // ZIP doesn't exist - insert new
        const newZipData = {
          worker_id: workerId,
          service_area_id: areaId,
          zipcode,
          from_manual: source === 'manual',
          from_polygon: source === 'polygon'
        };

        const { error: insertError } = await supabase
          .from('worker_service_zipcodes')
          .insert(newZipData);

        if (insertError) {
          console.error(`Error inserting ZIP ${zipcode}:`, insertError);
          conflicts.push({ zipcode, error: insertError.message });
        } else {
          inserted++;
          console.log(`Inserted new ZIP ${zipcode} with flags:`, newZipData);
        }
      }
    } catch (error) {
      console.error(`Unexpected error processing ZIP ${zipcode}:`, error);
      conflicts.push({ zipcode, error: error.message });
    }
  }

  return { inserted, updated, skipped, conflicts };
}

// Function to clean up orphaned ZIPs (no longer from any source)
async function cleanupOrphanedZipcodes(supabase: any, workerId: string): Promise<number> {
  const { data: orphanedZips, error: orphanedError } = await supabase
    .from('worker_service_zipcodes')
    .select('zipcode')
    .eq('worker_id', workerId)
    .eq('from_manual', false)
    .eq('from_polygon', false);

  if (orphanedError) {
    console.error('Error finding orphaned ZIPs:', orphanedError);
    return 0;
  }

  if (orphanedZips && orphanedZips.length > 0) {
    const { error: deleteError } = await supabase
      .from('worker_service_zipcodes')
      .delete()
      .eq('worker_id', workerId)
      .eq('from_manual', false)
      .eq('from_polygon', false);

    if (deleteError) {
      console.error('Error deleting orphaned ZIPs:', deleteError);
      return 0;
    }

    console.log(`Cleaned up ${orphanedZips.length} orphaned ZIP codes`);
    return orphanedZips.length;
  }

  return 0;
}