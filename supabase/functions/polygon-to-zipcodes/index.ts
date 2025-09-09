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

// Function to get ZIP codes from Supabase database within bounds
async function getZipCodesFromSupabase(supabase: any, bounds: any): Promise<Array<{ zipcode: string; lat: number; lng: number; city: string; state: string }>> {
  try {
    // Add small buffer to bounds to catch ZIP codes on edges (about 0.01 degrees ≈ 1km)
    const buffer = 0.01;
    const { data, error } = await supabase
      .from('us_zip_codes')
      .select('zipcode, latitude, longitude, city, state')
      .gte('latitude', bounds.south - buffer)
      .lte('latitude', bounds.north + buffer)
      .gte('longitude', bounds.west - buffer)
      .lte('longitude', bounds.east + buffer)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      console.warn('Error fetching ZIP codes from Supabase:', error);
      return [];
    }

    return data?.map((row: any) => ({
      zipcode: row.zipcode,
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude),
      city: row.city,
      state: row.state
    })) || [];
  } catch (error) {
    console.warn('Failed to fetch ZIP codes from Supabase:', error);
    return [];
  }
}

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

// Enhanced zipcode lookup using Supabase database with reverse geocoding fallback
async function findZipcodesInPolygon(polygon: PolygonPoint[], supabase: any): Promise<string[]> {
  console.log(`Processing polygon with ${polygon.length} points`);
  
  // Get polygon bounds first
  const bounds = getBounds(polygon);
  console.log('Polygon bounds:', bounds);
  
  // Get ZIP codes from Supabase within the bounds
  const supabaseZipcodes = await getZipCodesFromSupabase(supabase, bounds);
  console.log(`Fetched ${supabaseZipcodes.length} ZIP codes from Supabase within bounds`);
  
  // Filter ZIP codes that are actually within the polygon
  const polygonZipcodes = supabaseZipcodes
    .filter(zipData => isPointInPolygon({ lat: zipData.lat, lng: zipData.lng }, polygon))
    .map(zipData => zipData.zipcode);
  
  console.log(`Found ${polygonZipcodes.length} ZIP codes within polygon from Supabase data`);
  
  // If we found ZIP codes from Supabase, return them (they should be comprehensive)
  if (polygonZipcodes.length > 0) {
    return [...new Set(polygonZipcodes)]; // Remove duplicates
  }
  
  // Only use reverse geocoding as last resort if no ZIP codes found in Supabase
  console.log('No ZIP codes found in Supabase data, trying reverse geocoding fallback...');
  const geocodedZipcodes = await getZipcodesFromGeocoding(polygon);
  
  return [...new Set(geocodedZipcodes)]; // Remove duplicates
}

// Use Nominatim (OpenStreetMap) reverse geocoding to find ZIP codes
async function getZipcodesFromGeocoding(polygon: PolygonPoint[]): Promise<string[]> {
  const zipcodes: string[] = [];
  const bounds = getBounds(polygon);
  
  // Sample points within the polygon for reverse geocoding
  const samplePoints = generateSamplePoints(polygon, bounds);
  
  for (const point of samplePoints) {
    try {
      // Rate limiting: wait 1 second between requests to respect Nominatim usage policy
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.lat}&lon=${point.lng}&addressdetails=1&zoom=18`,
        {
          headers: {
            'User-Agent': 'ServiceAreaMapper/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const zipcode = data.address?.postcode;
        
        if (zipcode && /^\d{5}(-\d{4})?$/.test(zipcode)) {
          // Extract 5-digit ZIP code
          const zip5 = zipcode.split('-')[0];
          if (!zipcodes.includes(zip5)) {
            zipcodes.push(zip5);
            console.log(`Found ZIP code ${zip5} via reverse geocoding`);
          }
        }
      }
    } catch (error) {
      console.warn('Reverse geocoding failed for point:', point, error);
    }
    
    // Stop if we have enough ZIP codes
    if (zipcodes.length >= 5) break;
  }
  
  return zipcodes;
}

// Generate sample points within the polygon for reverse geocoding
function generateSamplePoints(polygon: PolygonPoint[], bounds: any): PolygonPoint[] {
  const points: PolygonPoint[] = [];
  
  // Add polygon centroid first (most likely to be representative)
  const centroid = getPolygonCentroid(polygon);
  points.push(centroid);
  
  // Add polygon center based on bounds
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east + bounds.west) / 2;
  if (centerLat !== centroid.lat || centerLng !== centroid.lng) {
    points.push({ lat: centerLat, lng: centerLng });
  }
  
  // Add some grid points within bounds for better coverage
  const latStep = (bounds.north - bounds.south) / 5;
  const lngStep = (bounds.east - bounds.west) / 5;
  
  for (let i = 1; i <= 4; i++) {
    for (let j = 1; j <= 4; j++) {
      const lat = bounds.south + i * latStep;
      const lng = bounds.west + j * lngStep;
      const point = { lat, lng };
      
      // Only include points that are actually inside the polygon
      if (isPointInPolygon(point, polygon)) {
        points.push(point);
      }
    }
  }
  
  // Limit to 8 points to avoid too many API calls but ensure good coverage
  return points.slice(0, 8);
}

// Calculate the centroid of a polygon (geometric center)
function getPolygonCentroid(polygon: PolygonPoint[]): PolygonPoint {
  let area = 0;
  let x = 0;
  let y = 0;
  
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const v = polygon[i].lng * polygon[j].lat - polygon[j].lng * polygon[i].lat;
    area += v;
    x += (polygon[i].lng + polygon[j].lng) * v;
    y += (polygon[i].lat + polygon[j].lat) * v;
  }
  
  area *= 0.5;
  
  if (area === 0) {
    // Fallback to simple average if area calculation fails
    const avgLat = polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;
    const avgLng = polygon.reduce((sum, p) => sum + p.lng, 0) / polygon.length;
    return { lat: avgLat, lng: avgLng };
  }
  
  return {
    lat: y / (6 * area),
    lng: x / (6 * area)
  };
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
      zipcodes = await findZipcodesInPolygon(polygon, supabase);
      console.log(`Found ${zipcodes.length} zipcodes in polygon`);
    }
    
    if (zipcodes.length === 0) {
      // Try to suggest a ZIP code based on polygon centroid
      const bounds = getBounds(polygon);
      const centroid = getPolygonCentroid(polygon);
      
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${centroid.lat}&lon=${centroid.lng}&addressdetails=1&zoom=18`,
          {
            headers: {
              'User-Agent': 'ServiceAreaMapper/1.0'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const zipcode = data.address?.postcode;
          let suggestedZip = '';
          
          if (zipcode && /^\d{5}(-\d{4})?$/.test(zipcode)) {
            suggestedZip = zipcode.split('-')[0];
          }
          
          return new Response(
            JSON.stringify({
              success: false,
              error: 'NO_ZIPCODES_FOUND',
              message: `No ZIP codes found in the selected area.${suggestedZip ? ` Try ZIP code ${suggestedZip} based on the center of your selection.` : ' You can manually add ZIP codes instead.'}`,
              suggestManualMode: true,
              suggestedZip: suggestedZip || null
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
      } catch (error) {
        console.warn('Failed to get suggested ZIP code:', error);
      }
      
      // Fallback without suggestion
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NO_ZIPCODES_FOUND',
          message: 'No ZIP codes found in the selected area. You can manually add ZIP codes instead.',
          suggestManualMode: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
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