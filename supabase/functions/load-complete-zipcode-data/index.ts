import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sample comprehensive US ZIP code dataset with ZCTA polygon data
const US_ZIP_DATASET = [
  // Major US metropolitan areas - sample dataset
  { zipcode: '10001', city: 'New York', state: 'NY', state_abbr: 'NY', lat: 40.7505, lng: -73.9934 },
  { zipcode: '10002', city: 'New York', state: 'NY', state_abbr: 'NY', lat: 40.7157, lng: -73.9877 },
  { zipcode: '10003', city: 'New York', state: 'NY', state_abbr: 'NY', lat: 40.7310, lng: -73.9896 },
  { zipcode: '90210', city: 'Beverly Hills', state: 'CA', state_abbr: 'CA', lat: 34.0901, lng: -118.4065 },
  { zipcode: '90211', city: 'Beverly Hills', state: 'CA', state_abbr: 'CA', lat: 34.0840, lng: -118.3998 },
  { zipcode: '90212', city: 'Beverly Hills', state: 'CA', state_abbr: 'CA', lat: 34.0696, lng: -118.3971 },
  { zipcode: '60601', city: 'Chicago', state: 'IL', state_abbr: 'IL', lat: 41.8827, lng: -87.6233 },
  { zipcode: '60602', city: 'Chicago', state: 'IL', state_abbr: 'IL', lat: 41.8796, lng: -87.6369 },
  { zipcode: '60603', city: 'Chicago', state: 'IL', state_abbr: 'IL', lat: 41.8767, lng: -87.6298 },
  { zipcode: '77001', city: 'Houston', state: 'TX', state_abbr: 'TX', lat: 29.7342, lng: -95.3689 },
  { zipcode: '77002', city: 'Houston', state: 'TX', state_abbr: 'TX', lat: 29.7515, lng: -95.3687 },
  { zipcode: '77003', city: 'Houston', state: 'TX', state_abbr: 'TX', lat: 29.7405, lng: -95.3507 },
  { zipcode: '33101', city: 'Miami', state: 'FL', state_abbr: 'FL', lat: 25.7743, lng: -80.1937 },
  { zipcode: '33102', city: 'Miami', state: 'FL', state_abbr: 'FL', lat: 25.7889, lng: -80.2264 },
  { zipcode: '33103', city: 'Miami', state: 'FL', state_abbr: 'FL', lat: 25.7663, lng: -80.1916 },
  // Dallas/Fort Worth area (expanded)
  { zipcode: '75201', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7767, lng: -96.7970 },
  { zipcode: '75202', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7831, lng: -96.8067 },
  { zipcode: '75203', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7341, lng: -96.8103 },
  { zipcode: '75204', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7919, lng: -96.7844 },
  { zipcode: '75205', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.8058, lng: -96.7906 },
  { zipcode: '75206', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7889, lng: -96.7508 },
  { zipcode: '75207', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7450, lng: -96.8417 },
  { zipcode: '75208', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7253, lng: -96.8619 },
  { zipcode: '75209', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.8400, lng: -96.8019 },
  { zipcode: '75210', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7450, lng: -96.7136 },
  { zipcode: '75211', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7097, lng: -96.8361 },
  { zipcode: '75212', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7631, lng: -96.8775 },
  { zipcode: '75214', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7770, lng: -96.7133 },
  { zipcode: '75215', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7281, lng: -96.7758 },
  { zipcode: '75216', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.6917, lng: -96.8139 },
  { zipcode: '75217', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7061, lng: -96.7342 },
  { zipcode: '75218', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.8408, lng: -96.7267 },
  { zipcode: '75219', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.7989, lng: -96.8067 },
  { zipcode: '75220', city: 'Dallas', state: 'TX', state_abbr: 'TX', lat: 32.8631, lng: -96.8531 },
  // Fort Worth
  { zipcode: '76101', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.7253, lng: -97.3308 },
  { zipcode: '76102', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.7411, lng: -97.3447 },
  { zipcode: '76103', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.7106, lng: -97.3564 },
  { zipcode: '76104', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.6931, lng: -97.3186 },
  { zipcode: '76105', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.6853, lng: -97.2736 },
  { zipcode: '76106', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.7417, lng: -97.3964 },
  { zipcode: '76107', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.7681, lng: -97.3897 },
  { zipcode: '76108', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.7375, lng: -97.4258 },
  { zipcode: '76109', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.7739, lng: -97.3531 },
  { zipcode: '76110', city: 'Fort Worth', state: 'TX', state_abbr: 'TX', lat: 32.6906, lng: -97.3564 },
  // Additional major cities for testing
  { zipcode: '98101', city: 'Seattle', state: 'WA', state_abbr: 'WA', lat: 47.6061, lng: -122.3328 },
  { zipcode: '98102', city: 'Seattle', state: 'WA', state_abbr: 'WA', lat: 47.6306, lng: -122.3228 },
  { zipcode: '02101', city: 'Boston', state: 'MA', state_abbr: 'MA', lat: 42.3601, lng: -71.0589 },
  { zipcode: '02102', city: 'Boston', state: 'MA', state_abbr: 'MA', lat: 42.3467, lng: -71.0467 },
  { zipcode: '30301', city: 'Atlanta', state: 'GA', state_abbr: 'GA', lat: 33.7490, lng: -84.3880 },
  { zipcode: '30302', city: 'Atlanta', state: 'GA', state_abbr: 'GA', lat: 33.7550, lng: -84.3925 },
  { zipcode: '80201', city: 'Denver', state: 'CO', state_abbr: 'CO', lat: 39.7392, lng: -104.9903 },
  { zipcode: '80202', city: 'Denver', state: 'CO', state_abbr: 'CO', lat: 39.7517, lng: -104.9856 },
  { zipcode: '85001', city: 'Phoenix', state: 'AZ', state_abbr: 'AZ', lat: 33.4484, lng: -112.0740 },
  { zipcode: '85002', city: 'Phoenix', state: 'AZ', state_abbr: 'AZ', lat: 33.4734, lng: -112.0831 },
];

// Sample ZCTA polygon data (simplified for demonstration)
const SAMPLE_ZCTA_POLYGONS = [
  {
    zcta5ce: '75201',
    geom: `POLYGON((-96.8070 32.7667, -96.7870 32.7667, -96.7870 32.7867, -96.8070 32.7867, -96.8070 32.7667))`,
    land_area: 2500000,
    water_area: 0
  },
  {
    zcta5ce: '75202', 
    geom: `POLYGON((-96.8167 32.7731, -96.7967 32.7731, -96.7967 32.7931, -96.8167 32.7931, -96.8167 32.7731))`,
    land_area: 1800000,
    water_area: 50000
  },
  {
    zcta5ce: '10001',
    geom: `POLYGON((-73.9934 40.7405, -73.9834 40.7405, -73.9834 40.7605, -73.9934 40.7605, -73.9934 40.7405))`,
    land_area: 900000,
    water_area: 0
  },
  {
    zcta5ce: '90210',
    geom: `POLYGON((-118.4165 34.0801, -118.3965 34.0801, -118.3965 34.1001, -118.4165 34.1001, -118.4165 34.0801))`,
    land_area: 5800000,
    water_area: 0
  }
];

interface LoadProgress {
  stage: string;
  zipcodesLoaded: number;
  polygonsLoaded: number;
  totalZipcodes: number;
  totalPolygons: number;
  errors: string[];
}

interface LoadResult {
  success: boolean;
  zipcodesLoaded: number;
  polygonsLoaded: number;
  errors: string[];
  validationResults?: any;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, testMode = false } = await req.json();
    
    console.log(`Load complete zipcode data request - Action: ${action}, Test Mode: ${testMode}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (action) {
      case 'load_sample_data':
        return await loadSampleData(supabase, testMode);
      case 'validate_data':
        return await validateLoadedData(supabase);
      case 'get_progress':
        return await getLoadProgress(supabase);
      case 'clear_data':
        return await clearExistingData(supabase);
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Load zipcode data error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function loadSampleData(supabase: any, testMode: boolean): Promise<Response> {
  const progress: LoadProgress = {
    stage: 'Starting data load',
    zipcodesLoaded: 0,
    polygonsLoaded: 0,
    totalZipcodes: US_ZIP_DATASET.length,
    totalPolygons: SAMPLE_ZCTA_POLYGONS.length,
    errors: []
  };

  try {
    console.log('Starting comprehensive ZIP code data load...');
    
    // Step 1: Load ZIP code points
    progress.stage = 'Loading ZIP code points';
    console.log(`Loading ${US_ZIP_DATASET.length} ZIP codes...`);
    
    const zipBatchSize = 20;
    for (let i = 0; i < US_ZIP_DATASET.length; i += zipBatchSize) {
      const batch = US_ZIP_DATASET.slice(i, i + zipBatchSize);
      
      const { error: zipError } = await supabase
        .from('us_zip_codes')
        .upsert(batch, { 
          onConflict: 'zipcode',
          ignoreDuplicates: false 
        });
      
      if (zipError) {
        console.error(`ZIP batch ${i}-${i + batch.length} error:`, zipError);
        progress.errors.push(`ZIP batch error: ${zipError.message}`);
      } else {
        progress.zipcodesLoaded += batch.length;
        console.log(`Loaded ZIP batch ${i + 1}-${Math.min(i + zipBatchSize, US_ZIP_DATASET.length)}`);
      }
    }

    // Step 2: Load ZCTA polygons
    progress.stage = 'Loading ZCTA polygons';
    console.log(`Loading ${SAMPLE_ZCTA_POLYGONS.length} ZCTA polygons...`);
    
    for (const polygon of SAMPLE_ZCTA_POLYGONS) {
      try {
        const { error: polyError } = await supabase
          .from('us_zcta_polygons')
          .upsert({
            zcta5ce: polygon.zcta5ce,
            geom: `ST_GeomFromText('${polygon.geom}', 4326)`,
            land_area: polygon.land_area,
            water_area: polygon.water_area
          }, { 
            onConflict: 'zcta5ce',
            ignoreDuplicates: false 
          });
        
        if (polyError) {
          console.error(`ZCTA polygon ${polygon.zcta5ce} error:`, polyError);
          progress.errors.push(`ZCTA ${polygon.zcta5ce}: ${polyError.message}`);
        } else {
          progress.polygonsLoaded++;
          console.log(`Loaded ZCTA polygon: ${polygon.zcta5ce}`);
        }
      } catch (err) {
        console.error(`Failed to load ZCTA ${polygon.zcta5ce}:`, err);
        progress.errors.push(`ZCTA ${polygon.zcta5ce}: ${err.message}`);
      }
    }

    // Step 3: Validate the loaded data
    progress.stage = 'Validating loaded data';
    console.log('Running validation tests...');
    
    const validation = await validateLoadedData(supabase);
    const validationData = await validation.json();

    const result: LoadResult = {
      success: progress.errors.length === 0,
      zipcodesLoaded: progress.zipcodesLoaded,
      polygonsLoaded: progress.polygonsLoaded,
      errors: progress.errors,
      validationResults: validationData
    };

    console.log('Data load completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Data load failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        progress
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
}

async function validateLoadedData(supabase: any): Promise<Response> {
  try {
    console.log('Validating loaded ZIP code data...');

    // Check ZIP code count
    const { count: zipCount, error: zipCountError } = await supabase
      .from('us_zip_codes')
      .select('*', { count: 'exact', head: true });

    if (zipCountError) {
      throw new Error(`ZIP count query failed: ${zipCountError.message}`);
    }

    // Check ZCTA polygon count
    const { count: zctaCount, error: zctaCountError } = await supabase
      .from('us_zcta_polygons')
      .select('*', { count: 'exact', head: true });

    if (zctaCountError) {
      throw new Error(`ZCTA count query failed: ${zctaCountError.message}`);
    }

    // Test spatial query
    let spatialTestSuccess = false;
    let spatialTestResults = null;
    
    try {
      const { data: testData, error: testError } = await supabase.rpc('check_spatial_health');
      
      if (!testError && testData) {
        spatialTestSuccess = testData.health_data?.overall_health === 'healthy';
        spatialTestResults = testData;
      }
    } catch (spatialError) {
      console.log('Spatial test warning:', spatialError);
    }

    const validationResults = {
      zipcodesCount: zipCount || 0,
      zctaPolygonsCount: zctaCount || 0,
      spatialTestSuccess,
      spatialTestResults,
      recommendedActions: []
    };

    // Generate recommendations
    if (validationResults.zipcodesCount < 40000) {
      validationResults.recommendedActions.push(
        `ZIP codes: ${validationResults.zipcodesCount}/41,000+ loaded. Consider loading complete dataset.`
      );
    }
    
    if (validationResults.zctaPolygonsCount < 30000) {
      validationResults.recommendedActions.push(
        `ZCTA polygons: ${validationResults.zctaPolygonsCount}/33,000+ loaded. Load Census ZCTA shapefiles.`
      );
    }

    if (!spatialTestSuccess) {
      validationResults.recommendedActions.push(
        'Spatial queries not fully functional. Check PostGIS configuration.'
      );
    }

    console.log('Validation completed:', validationResults);

    return new Response(
      JSON.stringify(validationResults),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation failed:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        zipcodesCount: 0,
        zctaPolygonsCount: 0,
        spatialTestSuccess: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
}

async function getLoadProgress(supabase: any): Promise<Response> {
  try {
    const { count: zipCount } = await supabase
      .from('us_zip_codes')
      .select('*', { count: 'exact', head: true });

    const { count: zctaCount } = await supabase
      .from('us_zcta_polygons')
      .select('*', { count: 'exact', head: true });

    const progress = {
      zipcodesLoaded: zipCount || 0,
      polygonsLoaded: zctaCount || 0,
      totalExpectedZipcodes: 41000,
      totalExpectedPolygons: 33000,
      completionPercentage: {
        zipcodes: Math.round(((zipCount || 0) / 41000) * 100),
        polygons: Math.round(((zctaCount || 0) / 33000) * 100)
      }
    };

    return new Response(
      JSON.stringify(progress),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
}

async function clearExistingData(supabase: any): Promise<Response> {
  try {
    console.log('Clearing existing ZIP code data...');

    // Clear ZCTA polygons first (due to potential dependencies)
    const { error: zctaError } = await supabase
      .from('us_zcta_polygons')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (zctaError) {
      console.error('ZCTA clear error:', zctaError);
    }

    // Clear ZIP codes
    const { error: zipError } = await supabase
      .from('us_zip_codes')
      .delete()
      .neq('zipcode', '00000'); // Delete all

    if (zipError) {
      console.error('ZIP clear error:', zipError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data cleared successfully',
        errors: [zctaError, zipError].filter(Boolean).map(e => e.message)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
}