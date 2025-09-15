import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportProgress {
  total: number
  processed: number
  errors: number
  status: 'running' | 'completed' | 'failed'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { operation, data_source = 'census' } = await req.json()

    console.log('Starting comprehensive ZIP data import:', { operation, data_source })

    switch (operation) {
      case 'import_census_zip_codes':
        return await importCensusZipCodes(supabase)
      case 'import_zcta_polygons':
        return await importZctaPolygons(supabase)
      case 'get_import_status':
        return await getImportStatus(supabase)
      case 'validate_data':
        return await validateImportedData(supabase)
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown operation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function importCensusZipCodes(supabase: any) {
  try {
    console.log('Starting Kaggle ZIP codes dataset import...');
    
    // Read the CSV file from the edge function directory
    const csvPath = new URL('./USZipsWithLatLon_20231227.csv', import.meta.url).pathname;
    const csvContent = await Deno.readTextFile(csvPath);
    
    // Parse CSV content
    const zipCodes = await parseKaggleZipCodes(csvContent);
    console.log(`Processing ${zipCodes.length} ZIP codes from Kaggle dataset...`);
    
    const batchSize = 500; // Increased batch size for better performance
    const batches = [];
    
    for (let i = 0; i < zipCodes.length; i += batchSize) {
      batches.push(zipCodes.slice(i, i + batchSize));
    }
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} records)...`);
        
        const { error } = await supabase
          .from('comprehensive_zip_codes')
          .upsert(batch, {
            onConflict: 'zipcode',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error('Batch insert error:', error);
          errorCount += batch.length;
        } else {
          processedCount += batch.length;
          console.log(`Successfully processed ${processedCount} ZIP codes so far...`);
        }
      } catch (batchError) {
        console.error('Batch processing error:', batchError);
        errorCount += batch.length;
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Kaggle ZIP codes import completed`,
        processed: processedCount,
        errors: errorCount,
        total: zipCodes.length,
        source: 'kaggle_dataset'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Failed to read or process Kaggle ZIP codes dataset'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function importZctaPolygons(supabase: any) {
  console.log('ZCTA polygon import not yet implemented - requires shapefile processing')
  
  return new Response(
    JSON.stringify({
      success: false,
      message: 'ZCTA polygon import requires shapefile processing implementation',
      note: 'This will be implemented in Phase 2 with proper GIS data handling'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getImportStatus(supabase: any) {
  try {
    const { count: zipCount } = await supabase
      .from('comprehensive_zip_codes')
      .select('*', { count: 'exact', head: true })
    
    const { count: polygonCount } = await supabase
      .from('comprehensive_zcta_polygons')
      .select('*', { count: 'exact', head: true })
    
    return new Response(
      JSON.stringify({
        zip_codes: zipCount || 0,
        zcta_polygons: polygonCount || 0,
        estimated_total_zips: 41484, // Updated to match Kaggle dataset
        estimated_total_polygons: 33120,
        coverage_percentage: {
          zip_codes: Math.round(((zipCount || 0) / 41484) * 100), // Updated to match Kaggle dataset
          polygons: Math.round(((polygonCount || 0) / 33120) * 100)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to get import status: ' + error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function validateImportedData(supabase: any) {
  try {
    // Sample validation queries
    const { data: sampleZips } = await supabase
      .from('comprehensive_zip_codes')
      .select('zipcode, city, state_abbr, latitude, longitude')
      .limit(10)
    
    const { data: stateCounts } = await supabase
      .from('comprehensive_zip_codes')
      .select('state_abbr')
      .limit(1000)
    
    const stateDistribution = stateCounts?.reduce((acc: any, row: any) => {
      acc[row.state_abbr] = (acc[row.state_abbr] || 0) + 1
      return acc
    }, {}) || {}
    
    return new Response(
      JSON.stringify({
        sample_data: sampleZips,
        state_distribution: stateDistribution,
        validation_passed: sampleZips && sampleZips.length > 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to validate data: ' + error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

// Parse Kaggle ZIP codes CSV dataset
async function parseKaggleZipCodes(csvContent: string) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  
  console.log('CSV Headers:', headers);
  
  const zipCodes = [];
  const errors = [];
  
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      
      // Map CSV fields to our database schema
      // Expected CSV format: ZIP,LAT,LNG,CITY,STATE_ID,STATE_NAME,ZCTA,PARENT_ZCTA,POPULATION,DENSITY,COUNTY_FIPS,COUNTY_NAME,COUNTY_WEIGHTS,COUNTY_NAMES_ALL,COUNTY_FIPS_ALL,IMPRECISE,MILITARY,TIMEZONE
      const zipRecord = {
        zipcode: values[0], // ZIP
        latitude: parseFloat(values[1]) || null, // LAT
        longitude: parseFloat(values[2]) || null, // LNG
        city: values[3] || '', // CITY
        state_abbr: values[4] || '', // STATE_ID
        state: values[5] || '', // STATE_NAME
        population: parseInt(values[8]) || null, // POPULATION
        timezone: values[17] || null, // TIMEZONE
        county: values[11] || null, // COUNTY_NAME
        data_source: 'kaggle_dataset'
      };
      
      // Validate required fields
      if (zipRecord.zipcode && zipRecord.city && zipRecord.state_abbr && zipRecord.state) {
        zipCodes.push(zipRecord);
      } else {
        errors.push(`Line ${i + 1}: Missing required fields`);
      }
      
    } catch (error) {
      errors.push(`Line ${i + 1}: Parse error - ${error.message}`);
    }
  }
  
  if (errors.length > 0) {
    console.log(`Parsing completed with ${errors.length} errors out of ${lines.length - 1} records`);
    console.log('Sample errors:', errors.slice(0, 5));
  }
  
  console.log(`Successfully parsed ${zipCodes.length} ZIP codes from Kaggle dataset`);
  return zipCodes;
}