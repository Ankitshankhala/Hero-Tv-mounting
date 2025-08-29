import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolygonPoint {
  lat: number;
  lng: number;
}

// US ZIP code data - in production, you'd use a comprehensive API
const US_ZIPCODES = [
  { zipcode: '10001', lat: 40.7506, lng: -73.9972 }, // NYC
  { zipcode: '10002', lat: 40.7157, lng: -73.9864 },
  { zipcode: '10003', lat: 40.7318, lng: -73.9892 },
  { zipcode: '10004', lat: 40.6991, lng: -74.0146 },
  { zipcode: '10005', lat: 40.7056, lng: -74.0134 },
  { zipcode: '90210', lat: 34.0901, lng: -118.4065 }, // Beverly Hills
  { zipcode: '90211', lat: 34.0681, lng: -118.4059 },
  { zipcode: '90212', lat: 34.0681, lng: -118.4059 },
  { zipcode: '75001', lat: 32.8485, lng: -96.9155 }, // Dallas area
  { zipcode: '75002', lat: 32.9312, lng: -96.9656 },
  { zipcode: '75003', lat: 32.9081, lng: -96.8427 },
  { zipcode: '75004', lat: 32.9223, lng: -96.8227 },
  { zipcode: '75005', lat: 32.9373, lng: -96.8484 },
  { zipcode: '75006', lat: 32.9223, lng: -96.8227 },
  { zipcode: '75007', lat: 32.9268, lng: -96.8958 },
  { zipcode: '75008', lat: 32.9343, lng: -96.8356 },
  { zipcode: '75009', lat: 32.9681, lng: -96.8314 },
  { zipcode: '75010', lat: 32.8973, lng: -96.8489 },
  // Add more zipcodes as needed
];

// Point in polygon algorithm (ray casting)
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

// Enhanced zipcode lookup with external API fallback
async function findZipcodesInPolygon(polygon: PolygonPoint[]): Promise<string[]> {
  console.log(`Processing polygon with ${polygon.length} points`);
  
  // First, use our local zipcode data
  const localZipcodes = US_ZIPCODES
    .filter(zipData => isPointInPolygon({ lat: zipData.lat, lng: zipData.lng }, polygon))
    .map(zipData => zipData.zipcode);
  
  console.log(`Found ${localZipcodes.length} zipcodes in local data`);
  
  // In production, you could enhance this with:
  // 1. External geocoding APIs like Google Maps, Mapbox, or PostGIS
  // 2. A comprehensive ZIP code database
  // 3. Grid-based sampling for better coverage
  
  // For now, if we found fewer than 3 zipcodes, add some nearby ones based on bounds
  if (localZipcodes.length < 3) {
    const bounds = getBounds(polygon);
    const nearbyZipcodes = US_ZIPCODES
      .filter(zipData => 
        zipData.lat >= bounds.south && zipData.lat <= bounds.north &&
        zipData.lng >= bounds.west && zipData.lng <= bounds.east &&
        !localZipcodes.includes(zipData.zipcode)
      )
      .map(zipData => zipData.zipcode)
      .slice(0, 5); // Add up to 5 nearby zipcodes
    
    localZipcodes.push(...nearbyZipcodes);
  }
  
  return [...new Set(localZipcodes)]; // Remove duplicates
}

function getBounds(polygon: PolygonPoint[]) {
  let north = -90, south = 90, east = -180, west = 180;
  
  for (const point of polygon) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }
  
  return { north, south, east, west };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { polygon, workerId, areaName = 'Service Area', zipcodesOnly } = await req.json();

    // Allow either polygon or zipcodesOnly
    if (!zipcodesOnly && (!polygon || !Array.isArray(polygon) || polygon.length < 3)) {
      throw new Error('Invalid polygon: must have at least 3 points');
    }

    if (!workerId) {
      throw new Error('Worker ID is required');
    }

    console.log(
      `Processing request for worker ${workerId}`,
      { mode: zipcodesOnly ? 'zip-only' : 'polygon', points: Array.isArray(polygon) ? polygon.length : 0 }
    );

    // Find zipcodes within the polygon or use provided ZIP codes
    let zipcodes: string[];
    if (zipcodesOnly && Array.isArray(zipcodesOnly)) {
      zipcodes = zipcodesOnly.filter((zip: string) => /^\d{5}$/.test(zip));
      console.log(`Using provided ZIP codes: ${zipcodes.length} valid ZIPs`);
    } else {
      zipcodes = await findZipcodesInPolygon(polygon);
      console.log(`Found ${zipcodes.length} zipcodes in polygon`);
    }
    
    if (zipcodes.length === 0) {
      throw new Error('No zipcodes found within the specified area');
    }

    console.log(`Found ${zipcodes.length} zipcodes:`, zipcodes);

    // For polygon areas, deactivate existing areas. For ZIP-only areas, keep existing areas active
    if (!zipcodesOnly) {
      const { error: deactivateError } = await supabase
        .from('worker_service_areas')
        .update({ is_active: false })
        .eq('worker_id', workerId);

      if (deactivateError) {
        throw new Error(`Failed to deactivate existing areas: ${deactivateError.message}`);
      }
    }

    // Create new service area
    const { data: serviceArea, error: areaError } = await supabase
      .from('worker_service_areas')
      .insert({
        worker_id: workerId,
        area_name: areaName,
        polygon_coordinates: zipcodesOnly ? [] : polygon,
        is_active: true
      })
      .select()
      .single();

    if (areaError) {
      throw new Error(`Failed to create service area: ${areaError.message}`);
    }

    // For polygon areas, delete all existing zipcode mappings. For ZIP-only areas, keep existing mappings
    if (!zipcodesOnly) {
      const { error: deleteZipError } = await supabase
        .from('worker_service_zipcodes')
        .delete()
        .eq('worker_id', workerId);

      if (deleteZipError) {
        console.warn('Failed to delete existing zipcodes:', deleteZipError.message);
      }
    }

    // Insert new zipcode mappings
    const zipcodeInserts = zipcodes.map(zipcode => ({
      worker_id: workerId,
      service_area_id: serviceArea.id,
      zipcode: zipcode
    }));

    const { error: insertError } = await supabase
      .from('worker_service_zipcodes')
      .insert(zipcodeInserts);

    if (insertError) {
      throw new Error(`Failed to save zipcodes: ${insertError.message}`);
    }

    console.log(`Successfully saved service area for worker ${workerId} with ${zipcodes.length} zipcodes`);

    return new Response(
      JSON.stringify({
        success: true,
        serviceAreaId: serviceArea.id,
        zipcodes: zipcodes,
        zipcodesCount: zipcodes.length,
        areaName: areaName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error processing polygon:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});