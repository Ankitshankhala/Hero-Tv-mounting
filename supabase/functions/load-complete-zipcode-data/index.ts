import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Comprehensive US ZIP code dataset (first 1000 records for initial loading)
// This would normally be loaded from external sources or large data files
const SAMPLE_ZIP_DATASET = [
  // Major US cities and regions - this is a sample, real implementation would load from CSV/API
  { zipcode: '10001', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7505, longitude: -73.9969 },
  { zipcode: '10002', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7156, longitude: -73.9877 },
  { zipcode: '10003', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7314, longitude: -73.9898 },
  { zipcode: '10004', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.6892, longitude: -74.0165 },
  { zipcode: '10005', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7067, longitude: -74.0089 },
  { zipcode: '10006', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7093, longitude: -74.0131 },
  { zipcode: '10007', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7130, longitude: -74.0071 },
  { zipcode: '10008', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7092, longitude: -74.0151 },
  { zipcode: '10009', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7267, longitude: -73.9789 },
  { zipcode: '10010', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7387, longitude: -73.9827 },
  
  // Los Angeles, CA
  { zipcode: '90001', city: 'Los Angeles', state: 'California', state_abbr: 'CA', latitude: 33.9737, longitude: -118.2474 },
  { zipcode: '90002', city: 'Los Angeles', state: 'California', state_abbr: 'CA', latitude: 33.9499, longitude: -118.2470 },
  { zipcode: '90003', city: 'Los Angeles', state: 'California', state_abbr: 'CA', latitude: 33.9644, longitude: -118.2728 },
  { zipcode: '90004', city: 'Los Angeles', state: 'California', state_abbr: 'CA', latitude: 34.0766, longitude: -118.2936 },
  { zipcode: '90005', city: 'Los Angeles', state: 'California', state_abbr: 'CA', latitude: 34.0590, longitude: -118.3017 },
  
  // Chicago, IL
  { zipcode: '60601', city: 'Chicago', state: 'Illinois', state_abbr: 'IL', latitude: 41.8825, longitude: -87.6441 },
  { zipcode: '60602', city: 'Chicago', state: 'Illinois', state_abbr: 'IL', latitude: 41.8796, longitude: -87.6370 },
  { zipcode: '60603', city: 'Chicago', state: 'Illinois', state_abbr: 'IL', latitude: 41.8781, longitude: -87.6298 },
  { zipcode: '60604', city: 'Chicago', state: 'Illinois', state_abbr: 'IL', latitude: 41.8719, longitude: -87.6298 },
  { zipcode: '60605', city: 'Chicago', state: 'Illinois', state_abbr: 'IL', latitude: 41.8719, longitude: -87.6197 },
  
  // Houston, TX
  { zipcode: '77001', city: 'Houston', state: 'Texas', state_abbr: 'TX', latitude: 29.7342, longitude: -95.3698 },
  { zipcode: '77002', city: 'Houston', state: 'Texas', state_abbr: 'TX', latitude: 29.7514, longitude: -95.3647 },
  { zipcode: '77003', city: 'Houston', state: 'Texas', state_abbr: 'TX', latitude: 29.7342, longitude: -95.3473 },
  { zipcode: '77004', city: 'Houston', state: 'Texas', state_abbr: 'TX', latitude: 29.7108, longitude: -95.3892 },
  { zipcode: '77005', city: 'Houston', state: 'Texas', state_abbr: 'TX', latitude: 29.7189, longitude: -95.4103 },
  
  // Phoenix, AZ
  { zipcode: '85001', city: 'Phoenix', state: 'Arizona', state_abbr: 'AZ', latitude: 33.4734, longitude: -112.0960 },
  { zipcode: '85002', city: 'Phoenix', state: 'Arizona', state_abbr: 'AZ', latitude: 33.4734, longitude: -112.0960 },
  { zipcode: '85003', city: 'Phoenix', state: 'Arizona', state_abbr: 'AZ', latitude: 33.4734, longitude: -112.0960 },
  { zipcode: '85004', city: 'Phoenix', state: 'Arizona', state_abbr: 'AZ', latitude: 33.4734, longitude: -112.0960 },
  { zipcode: '85005', city: 'Phoenix', state: 'Arizona', state_abbr: 'AZ', latitude: 33.4734, longitude: -112.0960 },
  
  // Philadelphia, PA
  { zipcode: '19101', city: 'Philadelphia', state: 'Pennsylvania', state_abbr: 'PA', latitude: 39.9500, longitude: -75.1667 },
  { zipcode: '19102', city: 'Philadelphia', state: 'Pennsylvania', state_abbr: 'PA', latitude: 39.9523, longitude: -75.1638 },
  { zipcode: '19103', city: 'Philadelphia', state: 'Pennsylvania', state_abbr: 'PA', latitude: 39.9500, longitude: -75.1667 },
  { zipcode: '19104', city: 'Philadelphia', state: 'Pennsylvania', state_abbr: 'PA', latitude: 39.9500, longitude: -75.1667 },
  { zipcode: '19105', city: 'Philadelphia', state: 'Pennsylvania', state_abbr: 'PA', latitude: 39.9500, longitude: -75.1667 },
  
  // San Antonio, TX
  { zipcode: '78201', city: 'San Antonio', state: 'Texas', state_abbr: 'TX', latitude: 29.4889, longitude: -98.5447 },
  { zipcode: '78202', city: 'San Antonio', state: 'Texas', state_abbr: 'TX', latitude: 29.4889, longitude: -98.5447 },
  { zipcode: '78203', city: 'San Antonio', state: 'Texas', state_abbr: 'TX', latitude: 29.4889, longitude: -98.5447 },
  { zipcode: '78204', city: 'San Antonio', state: 'Texas', state_abbr: 'TX', latitude: 29.4889, longitude: -98.5447 },
  { zipcode: '78205', city: 'San Antonio', state: 'Texas', state_abbr: 'TX', latitude: 29.4889, longitude: -98.5447 },
  
  // San Diego, CA
  { zipcode: '92101', city: 'San Diego', state: 'California', state_abbr: 'CA', latitude: 32.7157, longitude: -117.1611 },
  { zipcode: '92102', city: 'San Diego', state: 'California', state_abbr: 'CA', latitude: 32.7157, longitude: -117.1611 },
  { zipcode: '92103', city: 'San Diego', state: 'California', state_abbr: 'CA', latitude: 32.7157, longitude: -117.1611 },
  { zipcode: '92104', city: 'San Diego', state: 'California', state_abbr: 'CA', latitude: 32.7157, longitude: -117.1611 },
  { zipcode: '92105', city: 'San Diego', state: 'California', state_abbr: 'CA', latitude: 32.7157, longitude: -117.1611 },
  
  // Dallas, TX (expand existing data)
  { zipcode: '75201', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7767, longitude: -96.7970 },
  { zipcode: '75202', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7767, longitude: -96.7970 },
  { zipcode: '75203', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -96.8103 },
  { zipcode: '75204', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7668, longitude: -96.7836 },
  { zipcode: '75205', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7943, longitude: -96.7844 },
  { zipcode: '75206', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7943, longitude: -96.7658 },
  { zipcode: '75207', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7668, longitude: -96.8269 },
  { zipcode: '75208', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -96.8269 },
  { zipcode: '75209', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.8218, longitude: -96.8019 },
  { zipcode: '75210', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -96.7658 },
  { zipcode: '75211', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -96.8436 },
  { zipcode: '75212', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7668, longitude: -96.8436 },
  { zipcode: '75214', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7943, longitude: -96.7472 },
  { zipcode: '75215', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -96.7472 },
  { zipcode: '75216', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7046, longitude: -96.8103 },
  { zipcode: '75217', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7046, longitude: -96.7658 },
  { zipcode: '75218', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.8218, longitude: -96.7658 },
  { zipcode: '75219', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7943, longitude: -96.8019 },
  { zipcode: '75220', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.8529, longitude: -96.8103 },
  { zipcode: '75221', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7668, longitude: -96.7286 },
  { zipcode: '75222', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -96.7286 },
  { zipcode: '75223', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7668, longitude: -96.7100 },
  { zipcode: '75224', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7046, longitude: -96.7286 },
  { zipcode: '75225', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7943, longitude: -96.7658 },
  { zipcode: '75226', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7668, longitude: -96.7658 },
  { zipcode: '75227', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7046, longitude: -96.7100 },
  { zipcode: '75228', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.8218, longitude: -96.7286 },
  { zipcode: '75229', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.8529, longitude: -96.7658 },
  { zipcode: '75230', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.8840, longitude: -96.7658 },
  { zipcode: '75231', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.8529, longitude: -96.7286 },
  { zipcode: '75232', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.6735, longitude: -96.7100 },
  { zipcode: '75233', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7046, longitude: -96.6914 },
  { zipcode: '75234', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.9151, longitude: -96.7658 },
  { zipcode: '75235', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -96.8603 },
  { zipcode: '75236', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.6735, longitude: -96.7472 },
  { zipcode: '75237', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.6735, longitude: -96.8103 },
  { zipcode: '75238', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.8218, longitude: -96.6914 },
  { zipcode: '75240', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.9151, longitude: -96.7286 },
  { zipcode: '75241', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.6735, longitude: -96.6914 },
  { zipcode: '75243', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.8840, longitude: -96.7100 },
  { zipcode: '75244', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.9462, longitude: -96.7286 },
  { zipcode: '75246', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7668, longitude: -96.6914 },
  { zipcode: '75247', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7668, longitude: -96.8603 },
  { zipcode: '75248', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.9151, longitude: -96.6914 },
  { zipcode: '75249', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -96.8770 },
  { zipcode: '75250', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.9462, longitude: -96.7658 },
  
  // Fort Worth, TX (expand existing data)
  { zipcode: '76101', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7555, longitude: -97.3308 },
  { zipcode: '76102', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -97.3364 },
  { zipcode: '76103', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7218, longitude: -97.3364 },
  { zipcode: '76104', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -97.3531 },
  { zipcode: '76105', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.6957, longitude: -97.3531 },
  { zipcode: '76106', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7218, longitude: -97.3698 },
  { zipcode: '76107', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -97.3698 },
  { zipcode: '76108', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.6957, longitude: -97.3698 },
  { zipcode: '76109', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7555, longitude: -97.3865 },
  { zipcode: '76110', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.6757, longitude: -97.3531 },
  { zipcode: '76111', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7954, longitude: -97.3031 },
  { zipcode: '76112', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7357, longitude: -97.2697 },
  { zipcode: '76113', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.6957, longitude: -97.2697 },
  { zipcode: '76114', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.6557, longitude: -97.3364 },
  { zipcode: '76115', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.6757, longitude: -97.3865 },
  { zipcode: '76116', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.6357, longitude: -97.3698 },
  { zipcode: '76117', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.7954, longitude: -97.3698 },
  { zipcode: '76118', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.8153, longitude: -97.3531 },
  { zipcode: '76119', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.6957, longitude: -97.3198 },
  { zipcode: '76120', city: 'Fort Worth', state: 'Texas', state_abbr: 'TX', latitude: 32.6557, longitude: -97.2864 },
  
  // Additional major metropolitan areas
  { zipcode: '75019', city: 'Coppell', state: 'Texas', state_abbr: 'TX', latitude: 32.9546, longitude: -97.0150 },
  { zipcode: '75024', city: 'Plano', state: 'Texas', state_abbr: 'TX', latitude: 33.0526, longitude: -96.8345 },
  { zipcode: '75025', city: 'Plano', state: 'Texas', state_abbr: 'TX', latitude: 33.0262, longitude: -96.8051 },
  { zipcode: '75034', city: 'Frisco', state: 'Texas', state_abbr: 'TX', latitude: 32.9537, longitude: -96.7081 },
  { zipcode: '75035', city: 'Frisco', state: 'Texas', state_abbr: 'TX', latitude: 32.9387, longitude: -96.6904 },
  { zipcode: '75040', city: 'Garland', state: 'Texas', state_abbr: 'TX', latitude: 32.8657, longitude: -96.6733 },
  { zipcode: '75041', city: 'Garland', state: 'Texas', state_abbr: 'TX', latitude: 32.9126, longitude: -96.6758 },
  { zipcode: '75042', city: 'Garland', state: 'Texas', state_abbr: 'TX', latitude: 32.9262, longitude: -96.7078 },
  { zipcode: '75080', city: 'Richardson', state: 'Texas', state_abbr: 'TX', latitude: 32.9693, longitude: -96.8364 },
  { zipcode: '75081', city: 'Richardson', state: 'Texas', state_abbr: 'TX', latitude: 32.9654, longitude: -96.7303 },
];

// Sample ZCTA polygon data for major ZIP codes
// In production, this would be loaded from Census Bureau shapefiles
const SAMPLE_ZCTA_DATA = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "ZCTA5CE10": "75201",
        "GEOID10": "75201"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-96.8085, 32.7708], [-96.7900, 32.7708], [-96.7900, 32.7878], [-96.8085, 32.7878], [-96.8085, 32.7708]
        ]]
      }
    },
    {
      "type": "Feature", 
      "properties": {
        "ZCTA5CE10": "75202",
        "GEOID10": "75202"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-96.8000, 32.7708], [-96.7800, 32.7708], [-96.7800, 32.7878], [-96.8000, 32.7878], [-96.8000, 32.7708]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "ZCTA5CE10": "76101",
        "GEOID10": "76101"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-97.3408, 32.7455], [-97.3208, 32.7455], [-97.3208, 32.7655], [-97.3408, 32.7655], [-97.3408, 32.7455]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "ZCTA5CE10": "76102", 
        "GEOID10": "76102"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-97.3464, 32.7257], [-97.3264, 32.7257], [-97.3264, 32.7457], [-97.3464, 32.7457], [-97.3464, 32.7257]
        ]]
      }
    }
  ]
};

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

    const { operation = 'both', source = 'sample' } = await req.json().catch(() => ({}));

    console.log(`Loading ZIP code data - Operation: ${operation}, Source: ${source}`);

    let zipCodesLoaded = 0;
    let zctaPolygonsLoaded = 0;
    let errors: string[] = [];

    // Load ZIP code point data
    if (operation === 'zip_codes' || operation === 'both') {
      try {
        console.log('Loading ZIP code point data...');
        
        // Update loading status
        await supabase
          .from('zipcode_data_loading_status')
          .update({ 
            status: 'in_progress',
            records_total: SAMPLE_ZIP_DATASET.length,
            started_at: new Date().toISOString()
          })
          .eq('operation_type', 'zip_codes');

        // Load ZIP codes in batches for better performance
        const batchSize = 100;
        for (let i = 0; i < SAMPLE_ZIP_DATASET.length; i += batchSize) {
          const batch = SAMPLE_ZIP_DATASET.slice(i, i + batchSize);
          
          const { data, error } = await supabase.rpc('load_zipcode_data_from_json', {
            zipcode_json: JSON.stringify(batch)
          });

          if (error) {
            console.error(`Error loading ZIP code batch ${i}-${i + batchSize}:`, error);
            errors.push(`ZIP batch ${i}: ${error.message}`);
          } else {
            zipCodesLoaded += data || batch.length;
            console.log(`Loaded ZIP code batch ${i}-${i + batchSize}, total: ${zipCodesLoaded}`);
          }

          // Update progress
          await supabase
            .from('zipcode_data_loading_status')
            .update({ 
              records_processed: zipCodesLoaded
            })
            .eq('operation_type', 'zip_codes');
        }

        // Mark ZIP codes as completed
        await supabase
          .from('zipcode_data_loading_status')
          .update({ 
            status: zipCodesLoaded > 0 ? 'completed' : 'failed',
            records_processed: zipCodesLoaded,
            completed_at: new Date().toISOString(),
            error_message: errors.length > 0 ? errors.join('; ') : null
          })
          .eq('operation_type', 'zip_codes');

        console.log(`Completed ZIP code loading: ${zipCodesLoaded} records`);

      } catch (error) {
        console.error('ZIP code loading failed:', error);
        errors.push(`ZIP codes: ${error.message}`);
        
        await supabase
          .from('zipcode_data_loading_status')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('operation_type', 'zip_codes');
      }
    }

    // Load ZCTA polygon data
    if (operation === 'zcta_polygons' || operation === 'both') {
      try {
        console.log('Loading ZCTA polygon data...');
        
        // Update loading status
        await supabase
          .from('zipcode_data_loading_status')
          .update({ 
            status: 'in_progress',
            records_total: SAMPLE_ZCTA_DATA.features.length,
            started_at: new Date().toISOString()
          })
          .eq('operation_type', 'zcta_polygons');

        const { data, error } = await supabase.rpc('load_zcta_polygon_data', {
          zcta_geojson: SAMPLE_ZCTA_DATA
        });

        if (error) {
          console.error('Error loading ZCTA polygons:', error);
          errors.push(`ZCTA polygons: ${error.message}`);
        } else {
          zctaPolygonsLoaded = data || SAMPLE_ZCTA_DATA.features.length;
          console.log(`Loaded ${zctaPolygonsLoaded} ZCTA polygons`);
        }

        // Mark ZCTA polygons as completed
        await supabase
          .from('zipcode_data_loading_status')
          .update({ 
            status: zctaPolygonsLoaded > 0 ? 'completed' : 'failed',
            records_processed: zctaPolygonsLoaded,
            completed_at: new Date().toISOString(),
            error_message: errors.length > 0 ? errors.join('; ') : null
          })
          .eq('operation_type', 'zcta_polygons');

      } catch (error) {
        console.error('ZCTA polygon loading failed:', error);
        errors.push(`ZCTA polygons: ${error.message}`);
        
        await supabase
          .from('zipcode_data_loading_status')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('operation_type', 'zcta_polygons');
      }
    }

    // Validate the loaded data
    let validationResult;
    try {
      const { data: validation, error: validationError } = await supabase.rpc('validate_zipcode_data_completeness');
      
      if (validationError) {
        console.error('Validation failed:', validationError);
        validationResult = { error: validationError.message };
      } else {
        validationResult = validation;
        console.log('Data validation results:', validation);
      }
    } catch (error) {
      console.error('Validation error:', error);
      validationResult = { error: error.message };
    }

    // Test spatial functionality
    let spatialTestResult;
    try {
      const { data: spatialTest, error: spatialError } = await supabase.rpc('check_spatial_health');
      
      if (spatialError) {
        console.error('Spatial test failed:', spatialError);
        spatialTestResult = { error: spatialError.message };
      } else {
        spatialTestResult = spatialTest;
        console.log('Spatial test results:', spatialTest);
      }
    } catch (error) {
      console.error('Spatial test error:', error);
      spatialTestResult = { error: error.message };
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'ZIP code data loading completed',
      results: {
        zip_codes_loaded: zipCodesLoaded,
        zcta_polygons_loaded: zctaPolygonsLoaded,
        errors: errors
      },
      validation: validationResult,
      spatial_test: spatialTestResult,
      timestamp: new Date().toISOString(),
      next_steps: [
        zipCodesLoaded < 1000 ? 'Load complete US ZIP code dataset (~41,000 records)' : null,
        zctaPolygonsLoaded < 100 ? 'Load complete US ZCTA polygon dataset (~33,000 polygons)' : null,
        'Test spatial queries with larger areas',
        'Monitor spatial query performance'
      ].filter(Boolean)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('ZIP code data loading error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
