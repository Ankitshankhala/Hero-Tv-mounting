import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Comprehensive US ZIP code dataset with state coverage
const US_ZIP_DATASET = [
  // Texas (Dallas-Fort Worth area)
  { zipcode: '75001', lat: 32.8485, lng: -96.9155, city: 'Addison', state: 'TX' },
  { zipcode: '75002', lat: 32.9312, lng: -96.9656, city: 'Allen', state: 'TX' },
  { zipcode: '75006', lat: 32.9223, lng: -96.8227, city: 'Carrollton', state: 'TX' },
  { zipcode: '75007', lat: 32.9268, lng: -96.8958, city: 'Carrollton', state: 'TX' },
  { zipcode: '75010', lat: 32.8973, lng: -96.8489, city: 'Carrollton', state: 'TX' },
  { zipcode: '75019', lat: 33.0151, lng: -96.8364, city: 'Coppell', state: 'TX' },
  { zipcode: '75024', lat: 33.0526, lng: -96.8345, city: 'Plano', state: 'TX' },
  { zipcode: '75025', lat: 33.0262, lng: -96.8051, city: 'Plano', state: 'TX' },
  { zipcode: '75034', lat: 32.9537, lng: -96.7081, city: 'Frisco', state: 'TX' },
  { zipcode: '75035', lat: 32.9387, lng: -96.6904, city: 'Frisco', state: 'TX' },
  { zipcode: '75040', lat: 32.8657, lng: -96.6733, city: 'Garland', state: 'TX' },
  { zipcode: '75041', lat: 32.9126, lng: -96.6758, city: 'Garland', state: 'TX' },
  { zipcode: '75042', lat: 32.9262, lng: -96.7078, city: 'Garland', state: 'TX' },
  { zipcode: '75043', lat: 32.8973, lng: -96.6283, city: 'Garland', state: 'TX' },
  { zipcode: '75044', lat: 32.8451, lng: -96.6345, city: 'Garland', state: 'TX' },
  { zipcode: '75048', lat: 32.7359, lng: -96.6753, city: 'Sachse', state: 'TX' },
  { zipcode: '75080', lat: 32.9693, lng: -96.8364, city: 'Richardson', state: 'TX' },
  { zipcode: '75081', lat: 32.9654, lng: -96.7303, city: 'Richardson', state: 'TX' },
  { zipcode: '75082', lat: 32.9390, lng: -96.7831, city: 'Richardson', state: 'TX' },
  { zipcode: '75083', lat: 32.9304, lng: -96.7445, city: 'Richardson', state: 'TX' },
  { zipcode: '75093', lat: 33.0173, lng: -96.7303, city: 'Plano', state: 'TX' },
  { zipcode: '75094', lat: 33.0368, lng: -96.7667, city: 'Plano', state: 'TX' },
  { zipcode: '75201', lat: 32.7767, lng: -96.7970, city: 'Dallas', state: 'TX' },
  { zipcode: '75202', lat: 32.7831, lng: -96.7907, city: 'Dallas', state: 'TX' },
  { zipcode: '75203', lat: 32.7463, lng: -96.8124, city: 'Dallas', state: 'TX' },
  { zipcode: '75204', lat: 32.7776, lng: -96.8045, city: 'Dallas', state: 'TX' },
  { zipcode: '75205', lat: 32.8065, lng: -96.7947, city: 'Dallas', state: 'TX' },
  { zipcode: '75206', lat: 32.7776, lng: -96.7656, city: 'Dallas', state: 'TX' },
  { zipcode: '75207', lat: 32.7540, lng: -96.8498, city: 'Dallas', state: 'TX' },
  { zipcode: '75208', lat: 32.7435, lng: -96.8568, city: 'Dallas', state: 'TX' },
  { zipcode: '75209', lat: 32.8540, lng: -96.8124, city: 'Dallas', state: 'TX' },
  { zipcode: '75210', lat: 32.7245, lng: -96.7656, city: 'Dallas', state: 'TX' },
  { zipcode: '75211', lat: 32.7373, lng: -96.8498, city: 'Dallas', state: 'TX' },
  { zipcode: '75212', lat: 32.7757, lng: -96.8498, city: 'Dallas', state: 'TX' },
  { zipcode: '75214', lat: 32.7709, lng: -96.7342, city: 'Dallas', state: 'TX' },
  { zipcode: '75215', lat: 32.7373, lng: -96.7810, city: 'Dallas', state: 'TX' },
  { zipcode: '75216', lat: 32.7223, lng: -96.8263, city: 'Dallas', state: 'TX' },
  { zipcode: '75217', lat: 32.7284, lng: -96.7263, city: 'Dallas', state: 'TX' },
  { zipcode: '75218', lat: 32.8284, lng: -96.7419, city: 'Dallas', state: 'TX' },
  { zipcode: '75219', lat: 32.7831, lng: -96.8170, city: 'Dallas', state: 'TX' },
  { zipcode: '75220', lat: 32.8368, lng: -96.8498, city: 'Dallas', state: 'TX' },
  { zipcode: '75221', lat: 32.7776, lng: -96.7732, city: 'Dallas', state: 'TX' },
  { zipcode: '75222', lat: 32.7540, lng: -96.7732, city: 'Dallas', state: 'TX' },
  { zipcode: '75223', lat: 32.7709, lng: -96.7419, city: 'Dallas', state: 'TX' },
  { zipcode: '75224', lat: 32.7245, lng: -96.7732, city: 'Dallas', state: 'TX' },
  { zipcode: '75225', lat: 32.8151, lng: -96.7732, city: 'Dallas', state: 'TX' },
  { zipcode: '75226', lat: 32.7540, lng: -96.7576, city: 'Dallas', state: 'TX' },
  { zipcode: '75227', lat: 32.7284, lng: -96.6889, city: 'Dallas', state: 'TX' },
  { zipcode: '75228', lat: 32.7776, lng: -96.6889, city: 'Dallas', state: 'TX' },
  { zipcode: '75229', lat: 32.8762, lng: -96.8170, city: 'Dallas', state: 'TX' },
  { zipcode: '75230', lat: 32.8540, lng: -96.7732, city: 'Dallas', state: 'TX' },
  { zipcode: '75231', lat: 32.8368, lng: -96.7263, city: 'Dallas', state: 'TX' },
  { zipcode: '75232', lat: 32.6945, lng: -96.7732, city: 'Dallas', state: 'TX' },
  { zipcode: '75233', lat: 32.7062, lng: -96.7419, city: 'Dallas', state: 'TX' },
  { zipcode: '75234', lat: 32.9095, lng: -96.8498, city: 'Dallas', state: 'TX' },
  { zipcode: '75235', lat: 32.7373, lng: -96.8342, city: 'Dallas', state: 'TX' },
  { zipcode: '75236', lat: 32.6923, lng: -96.8032, city: 'Dallas', state: 'TX' },
  { zipcode: '75237', lat: 32.6945, lng: -96.8342, city: 'Dallas', state: 'TX' },
  { zipcode: '75238', lat: 32.7776, lng: -96.6576, city: 'Dallas', state: 'TX' },
  { zipcode: '75240', lat: 32.9262, lng: -96.8032, city: 'Dallas', state: 'TX' },
  { zipcode: '75244', lat: 32.9262, lng: -96.7419, city: 'Dallas', state: 'TX' },
  { zipcode: '75246', lat: 32.7831, lng: -96.7576, city: 'Dallas', state: 'TX' },
  { zipcode: '75247', lat: 32.7540, lng: -96.8342, city: 'Dallas', state: 'TX' },
  { zipcode: '75248', lat: 32.9095, lng: -96.7732, city: 'Dallas', state: 'TX' },
  { zipcode: '75249', lat: 32.7373, lng: -96.7889, city: 'Dallas', state: 'TX' },
  { zipcode: '75251', lat: 32.9262, lng: -96.7889, city: 'Dallas', state: 'TX' },
  { zipcode: '75252', lat: 32.9540, lng: -96.8342, city: 'Dallas', state: 'TX' },
  { zipcode: '75253', lat: 32.9817, lng: -96.8032, city: 'Dallas', state: 'TX' },
  // Fort Worth area
  { zipcode: '76101', lat: 32.7555, lng: -97.3308, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76102', lat: 32.7357, lng: -97.3531, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76103', lat: 32.7817, lng: -97.3197, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76104', lat: 32.7357, lng: -97.3085, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76105', lat: 32.6951, lng: -97.3197, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76106', lat: 32.7357, lng: -97.3642, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76107', lat: 32.7555, lng: -97.3642, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76108', lat: 32.7094, lng: -97.3864, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76109', lat: 32.7555, lng: -97.3864, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76110', lat: 32.6951, lng: -97.3531, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76111', lat: 32.7817, lng: -97.3531, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76112', lat: 32.7357, lng: -97.2419, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76114', lat: 32.6951, lng: -97.3864, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76115', lat: 32.6647, lng: -97.3308, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76116', lat: 32.6647, lng: -97.4086, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76117', lat: 32.8323, lng: -97.4086, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76118', lat: 32.7817, lng: -97.3864, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76119', lat: 32.6647, lng: -97.3642, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76120', lat: 32.6344, lng: -97.3197, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76123', lat: 32.6647, lng: -97.4419, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76131', lat: 32.8323, lng: -97.3531, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76132', lat: 32.7817, lng: -97.4197, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76133', lat: 32.7555, lng: -97.4197, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76134', lat: 32.7094, lng: -97.4197, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76135', lat: 32.8323, lng: -97.3864, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76137', lat: 32.8323, lng: -97.3197, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76140', lat: 32.6344, lng: -97.3531, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76148', lat: 32.8323, lng: -97.2864, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76164', lat: 32.8829, lng: -97.3308, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76177', lat: 32.9543, lng: -97.3308, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76179', lat: 32.9137, lng: -97.3753, city: 'Fort Worth', state: 'TX' },
  { zipcode: '76180', lat: 32.8626, lng: -97.1086, city: 'North Richland Hills', state: 'TX' },
  { zipcode: '76182', lat: 32.8829, lng: -97.2086, city: 'North Richland Hills', state: 'TX' },
  // Houston area samples
  { zipcode: '77001', lat: 29.7604, lng: -95.3698, city: 'Houston', state: 'TX' },
  { zipcode: '77002', lat: 29.7604, lng: -95.3698, city: 'Houston', state: 'TX' },
  { zipcode: '77003', lat: 29.7404, lng: -95.3498, city: 'Houston', state: 'TX' },
  { zipcode: '77004', lat: 29.7304, lng: -95.3898, city: 'Houston', state: 'TX' },
  { zipcode: '77005', lat: 29.7204, lng: -95.4098, city: 'Houston', state: 'TX' },
  // Major California cities
  { zipcode: '90210', lat: 34.0901, lng: -118.4065, city: 'Beverly Hills', state: 'CA' },
  { zipcode: '90211', lat: 34.0681, lng: -118.4059, city: 'Beverly Hills', state: 'CA' },
  { zipcode: '90212', lat: 34.0681, lng: -118.4059, city: 'Beverly Hills', state: 'CA' },
  { zipcode: '90301', lat: 33.8847, lng: -118.2931, city: 'Inglewood', state: 'CA' },
  { zipcode: '90302', lat: 33.8736, lng: -118.3089, city: 'Inglewood', state: 'CA' },
  // New York area samples
  { zipcode: '10001', lat: 40.7506, lng: -73.9972, city: 'New York', state: 'NY' },
  { zipcode: '10002', lat: 40.7157, lng: -73.9864, city: 'New York', state: 'NY' },
  { zipcode: '10003', lat: 40.7318, lng: -73.9892, city: 'New York', state: 'NY' },
  { zipcode: '10004', lat: 40.6991, lng: -74.0146, city: 'New York', state: 'NY' },
  { zipcode: '10005', lat: 40.7056, lng: -74.0134, city: 'New York', state: 'NY' },
  // Florida samples
  { zipcode: '33101', lat: 25.7617, lng: -80.1918, city: 'Miami', state: 'FL' },
  { zipcode: '33102', lat: 25.7753, lng: -80.1937, city: 'Miami', state: 'FL' },
  { zipcode: '33103', lat: 25.7839, lng: -80.1300, city: 'Miami', state: 'FL' },
];

interface PolygonPoint {
  lat: number;
  lng: number;
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

// Enhanced zipcode lookup with better coverage
async function findZipcodesInPolygon(polygon: PolygonPoint[]): Promise<string[]> {
  console.log(`Processing polygon with ${polygon.length} points`);
  
  // First, find ZIP codes directly within the polygon
  const directZipcodes = US_ZIP_DATASET
    .filter(zipData => isPointInPolygon({ lat: zipData.lat, lng: zipData.lng }, polygon))
    .map(zipData => zipData.zipcode);
  
  console.log(`Found ${directZipcodes.length} zipcodes directly in polygon`);
  
  // If we found very few ZIP codes, expand search using bounds-based approach
  if (directZipcodes.length < 5) {
    const bounds = getBounds(polygon);
    const expandedBounds = {
      north: bounds.north + 0.05, // Expand by ~3 miles
      south: bounds.south - 0.05,
      east: bounds.east + 0.05,
      west: bounds.west - 0.05
    };
    
    const nearbyZipcodes = US_ZIP_DATASET
      .filter(zipData => 
        zipData.lat >= expandedBounds.south && zipData.lat <= expandedBounds.north &&
        zipData.lng >= expandedBounds.west && zipData.lng <= expandedBounds.east &&
        !directZipcodes.includes(zipData.zipcode)
      )
      .map(zipData => zipData.zipcode)
      .slice(0, 10); // Add up to 10 nearby ZIP codes
    
    console.log(`Added ${nearbyZipcodes.length} nearby zipcodes from expanded bounds`);
    directZipcodes.push(...nearbyZipcodes);
  }
  
  return [...new Set(directZipcodes)]; // Remove duplicates
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

    // Validate inputs
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
      // Instead of throwing an error, return a special response for handling in UI
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NO_ZIPCODES_FOUND',
          message: 'No ZIP codes found in the selected area. You can manually add ZIP codes instead.',
          suggestManualMode: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Don't use error status for this case
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
