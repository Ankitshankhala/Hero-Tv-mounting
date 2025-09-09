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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { polygon, workerId, areaName, zipcodesOnly, mode = 'replace_all', areaId } = await req.json();

    console.log(`Processing request for worker ${workerId}`, { 
      mode: polygon ? 'polygon' : 'zipcodesOnly', 
      points: polygon?.length || 0,
      zipcodesCount: zipcodesOnly?.length || 0,
      assignmentMode: mode,
      targetAreaId: areaId
    });

    let zipcodes: string[] = [];

    if (zipcodesOnly && Array.isArray(zipcodesOnly)) {
      console.log('Processing zipcodesOnly mode with', zipcodesOnly.length, 'ZIP codes');
      zipcodes = zipcodesOnly;
    } else if (polygon && polygon.length >= 3) {
      console.log('Processing polygon with', polygon.length, 'points');
      zipcodes = await findZipcodesInPolygon(polygon, supabase);
      console.log('Found', zipcodes.length, 'zipcodes:', zipcodes);
    } else {
      throw new Error('Either polygon or zipcodesOnly must be provided');
    }

    // Handle service area management based on mode
    let targetServiceArea;

    if (mode === 'replace_all') {
      // Deactivate existing areas for this worker
      await supabase
        .from('worker_service_areas')
        .update({ is_active: false })
        .eq('worker_id', workerId);
      
      console.log('Deactivated existing service areas for replace_all mode');

      // Create new service area
      const { data: serviceArea, error: areaError } = await supabase
        .from('worker_service_areas')
        .insert({
          worker_id: workerId,
          area_name: areaName || `Service Area - ${new Date().toLocaleDateString()}`,
          polygon_coordinates: polygon || [],
          is_active: true
        })
        .select()
        .single();

      if (areaError) {
        throw new Error(`Failed to create service area: ${areaError.message}`);
      }
      
      targetServiceArea = serviceArea;
    } else {
      // Append mode - use existing area if provided, otherwise create new one
      if (areaId) {
        // Verify the area exists and belongs to this worker
        const { data: existingArea, error: areaFetchError } = await supabase
          .from('worker_service_areas')
          .select('*')
          .eq('id', areaId)
          .eq('worker_id', workerId)
          .eq('is_active', true)
          .single();

        if (areaFetchError || !existingArea) {
          throw new Error(`Target service area not found or inaccessible`);
        }
        
        targetServiceArea = existingArea;
        console.log(`Using existing service area: ${existingArea.area_name}`);
      } else {
        // Create new service area for append
        const { data: serviceArea, error: areaError } = await supabase
          .from('worker_service_areas')
          .insert({
            worker_id: workerId,
            area_name: areaName || `Additional Coverage - ${new Date().toLocaleDateString()}`,
            polygon_coordinates: polygon || [],
            is_active: true
          })
          .select()
          .single();

        if (areaError) {
          throw new Error(`Failed to create service area: ${areaError.message}`);
        }
        
        targetServiceArea = serviceArea;
        console.log(`Created new service area for append mode: ${serviceArea.area_name}`);
      }
    }

    // Insert zipcodes with comprehensive deduplication
    if (zipcodes.length > 0) {
      // Get existing zipcodes for this worker to avoid duplicates
      const { data: existingZips } = await supabase
        .from('worker_service_zipcodes')
        .select('zipcode')
        .eq('worker_id', workerId);
      
      const existingZipSet = new Set(existingZips?.map(z => z.zipcode) || []);
      const newZipcodes = zipcodes.filter(zip => !existingZipSet.has(zip));
      
      if (newZipcodes.length > 0) {
        const zipcodeMappings = newZipcodes.map(zipcode => ({
          worker_id: workerId,
          service_area_id: targetServiceArea.id,
          zipcode: zipcode.trim()
        }));

        const { error: zipError } = await supabase
          .from('worker_service_zipcodes')
          .insert(zipcodeMappings);

        if (zipError) {
          throw new Error(`Failed to insert zipcodes: ${zipError.message}`);
        }
        
        console.log(`Inserted ${newZipcodes.length} new ZIP codes, skipped ${zipcodes.length - newZipcodes.length} duplicates`);
      } else {
        console.log('All ZIP codes already existed, no new ones to insert');
      }
    }

    console.log(`Successfully saved service area for worker ${workerId} with ${zipcodes.length} zipcodes`);

    return new Response(JSON.stringify({
      success: true,
      serviceAreaId: targetServiceArea.id,
      zipcodesCount: zipcodes.length,
      newZipcodesCount: zipcodes.length - (existingZips?.length || 0),
      mode,
      message: `Successfully ${mode === 'replace_all' ? 'replaced' : 'added'} ZIP codes`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Polygon processing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});