import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZipCodeData {
  zipcode: string;
  city: string;
  state: string;
  state_abbr: string;
  latitude: number;
  longitude: number;
  county?: string;
  timezone?: string;
  population?: number;
  land_area?: number;
  water_area?: number;
}

// Sample dataset for testing (30 ZIP codes)
const SAMPLE_ZIP_DATASET: ZipCodeData[] = [
  { zipcode: '10001', city: 'New York', state: 'New York', state_abbr: 'NY', latitude: 40.7505, longitude: -73.9934, county: 'New York', timezone: 'America/New_York', population: 23056, land_area: 0.685, water_area: 0.0 },
  { zipcode: '90210', city: 'Beverly Hills', state: 'California', state_abbr: 'CA', latitude: 34.0901, longitude: -118.4065, county: 'Los Angeles', timezone: 'America/Los_Angeles', population: 21908, land_area: 5.71, water_area: 0.0 },
  { zipcode: '60601', city: 'Chicago', state: 'Illinois', state_abbr: 'IL', latitude: 41.8827, longitude: -87.6233, county: 'Cook', timezone: 'America/Chicago', population: 2389, land_area: 0.262, water_area: 0.0 },
  { zipcode: '75201', city: 'Dallas', state: 'Texas', state_abbr: 'TX', latitude: 32.7767, longitude: -96.7970, county: 'Dallas', timezone: 'America/Chicago', population: 1659, land_area: 1.89, water_area: 0.0 },
  { zipcode: '77001', city: 'Houston', state: 'Texas', state_abbr: 'TX', latitude: 29.7347, longitude: -95.3897, county: 'Harris', timezone: 'America/Chicago', population: 4412, land_area: 2.31, water_area: 0.0 },
];

// Load all ZIP codes from uploaded file
async function loadAllZipCodes(): Promise<string[]> {
  try {
    const fileContent = await Deno.readTextFile('./all_zipcodes.json');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error loading ZIP codes file:', error);
    return [];
  }
}

// Enhanced data enrichment using Zippopotam.us API
async function enrichZipCodeData(zipcode: string): Promise<ZipCodeData | null> {
  try {
    const response = await fetch(`http://api.zippopotam.us/us/${zipcode}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    const place = data.places[0];
    
    return {
      zipcode: zipcode,
      city: place['place name'],
      state: place['state'],
      state_abbr: place['state abbreviation'],
      latitude: parseFloat(place['latitude']),
      longitude: parseFloat(place['longitude']),
      county: place['place name'], // API limitation - using city as fallback
      timezone: getTimezoneByState(place['state abbreviation']),
      population: 0, // Not available in free API
      land_area: 0,
      water_area: 0
    };
  } catch (error) {
    console.error(`Error enriching ZIP ${zipcode}:`, error);
    return null;
  }
}

// Timezone mapping by state
function getTimezoneByState(stateAbbr: string): string {
  const timezoneMap: { [key: string]: string } = {
    'CA': 'America/Los_Angeles', 'WA': 'America/Los_Angeles', 'OR': 'America/Los_Angeles', 'NV': 'America/Los_Angeles',
    'AZ': 'America/Phoenix', 'UT': 'America/Denver', 'CO': 'America/Denver', 'WY': 'America/Denver', 'MT': 'America/Denver',
    'NM': 'America/Denver', 'ND': 'America/Denver', 'SD': 'America/Denver', 'NE': 'America/Denver', 'KS': 'America/Chicago',
    'OK': 'America/Chicago', 'TX': 'America/Chicago', 'MN': 'America/Chicago', 'IA': 'America/Chicago', 'MO': 'America/Chicago',
    'AR': 'America/Chicago', 'LA': 'America/Chicago', 'WI': 'America/Chicago', 'IL': 'America/Chicago', 'MI': 'America/Detroit',
    'IN': 'America/New_York', 'KY': 'America/New_York', 'TN': 'America/Chicago', 'MS': 'America/Chicago', 'AL': 'America/Chicago',
    'OH': 'America/New_York', 'WV': 'America/New_York', 'VA': 'America/New_York', 'NC': 'America/New_York', 'SC': 'America/New_York',
    'GA': 'America/New_York', 'FL': 'America/New_York', 'PA': 'America/New_York', 'NY': 'America/New_York', 'VT': 'America/New_York',
    'NH': 'America/New_York', 'ME': 'America/New_York', 'MA': 'America/New_York', 'RI': 'America/New_York', 'CT': 'America/New_York',
    'NJ': 'America/New_York', 'DE': 'America/New_York', 'MD': 'America/New_York', 'DC': 'America/New_York',
    'AK': 'America/Anchorage', 'HI': 'Pacific/Honolulu'
  };
  return timezoneMap[stateAbbr] || 'America/Chicago';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'load_sample_data':
        return await loadSampleZipData(supabase);
      case 'load_bulk_data':
        return await loadBulkZipData(supabase);
      case 'get_health_check':
        return await getDataHealthCheck(supabase);
      case 'clear_data':
        return await clearExistingData(supabase);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error) {
    console.error('Error in populate-comprehensive-zip-data:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Load sample ZIP data (fast testing)
async function loadSampleZipData(supabase: any) {
  try {
    console.log('Starting sample ZIP data load...');
    
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < SAMPLE_ZIP_DATASET.length; i += batchSize) {
      batches.push(SAMPLE_ZIP_DATASET.slice(i, i + batchSize));
    }
    
    let loadedCount = 0;
    const errors = [];
    
    for (const batch of batches) {
      try {
        const { data, error } = await supabase
          .from('comprehensive_zip_codes')
          .upsert(batch, { 
            onConflict: 'zipcode',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error('Batch error:', error);
          errors.push(error.message);
        } else {
          loadedCount += batch.length;
          console.log(`Loaded batch of ${batch.length} ZIP codes. Total: ${loadedCount}`);
        }
      } catch (batchError) {
        console.error('Batch processing error:', batchError);
        errors.push(batchError.message);
      }
    }
    
    const healthCheck = await runHealthCheck(supabase);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully loaded ${loadedCount} sample ZIP codes`,
        loadedCount,
        errors: errors.length > 0 ? errors : null,
        healthCheck
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error loading sample ZIP data:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to load sample ZIP data', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Load bulk ZIP data (33K+ ZIP codes with enrichment)
async function loadBulkZipData(supabase: any) {
  try {
    console.log('Starting bulk ZIP data load with enrichment...');
    
    // Load all ZIP codes from uploaded file
    const allZipCodes = await loadAllZipCodes();
    if (allZipCodes.length === 0) {
      throw new Error('No ZIP codes found in uploaded file');
    }
    
    console.log(`Processing ${allZipCodes.length} ZIP codes with data enrichment...`);
    
    const batchSize = 50; // Smaller batches for API rate limiting
    const enrichedData: ZipCodeData[] = [];
    const errors: string[] = [];
    let processed = 0;
    
    // Process in batches with enrichment
    for (let i = 0; i < allZipCodes.length; i += batchSize) {
      const batch = allZipCodes.slice(i, i + batchSize);
      const batchPromises = batch.map(async (zipcode) => {
        try {
          const enriched = await enrichZipCodeData(zipcode);
          if (enriched) {
            enrichedData.push(enriched);
          } else {
            errors.push(`Failed to enrich ZIP code: ${zipcode}`);
          }
          processed++;
          
          // Log progress every 1000 ZIP codes
          if (processed % 1000 === 0) {
            console.log(`Progress: ${processed}/${allZipCodes.length} ZIP codes processed`);
          }
        } catch (error) {
          errors.push(`Error processing ${zipcode}: ${error.message}`);
        }
      });
      
      // Wait for batch completion with rate limiting
      await Promise.allSettled(batchPromises);
      
      // Rate limiting: wait 1 second between batches to respect API limits
      if (i + batchSize < allZipCodes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Enrichment complete. Inserting ${enrichedData.length} ZIP codes into database...`);
    
    // Insert enriched data in batches
    const dbBatchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < enrichedData.length; i += dbBatchSize) {
      const dbBatch = enrichedData.slice(i, i + dbBatchSize);
      try {
        const { data, error } = await supabase
          .from('comprehensive_zip_codes')
          .upsert(dbBatch, { 
            onConflict: 'zipcode',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error('Database batch error:', error);
          errors.push(`DB Error: ${error.message}`);
        } else {
          insertedCount += dbBatch.length;
          console.log(`Inserted batch: ${insertedCount}/${enrichedData.length} ZIP codes`);
        }
      } catch (batchError) {
        console.error('Database batch processing error:', batchError);
        errors.push(`DB Batch Error: ${batchError.message}`);
      }
    }
    
    const healthCheck = await runHealthCheck(supabase);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully processed ${allZipCodes.length} ZIP codes, inserted ${insertedCount} with enriched data`,
        totalProcessed: allZipCodes.length,
        successfullyEnriched: enrichedData.length,
        insertedCount,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : null, // Limit error list
        healthCheck
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error loading bulk ZIP data:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to load bulk ZIP data', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function getDataHealthCheck(supabase: any) {
  try {
    const healthResult = await runHealthCheck(supabase);
    
    return new Response(
      JSON.stringify({
        success: true,
        healthCheck: healthResult
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error running health check:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Health check failed', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function clearExistingData(supabase: any) {
  try {
    console.log('Clearing existing comprehensive data...');
    
    // Clear ZCTA polygons first (potential foreign key dependencies)
    const { error: zctaError } = await supabase
      .from('comprehensive_zcta_polygons')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (zctaError) {
      console.error('Error clearing ZCTA polygons:', zctaError);
    }
    
    // Clear ZIP codes
    const { error: zipError } = await supabase
      .from('comprehensive_zip_codes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (zipError) {
      console.error('Error clearing ZIP codes:', zipError);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully cleared comprehensive data',
        errors: [zctaError, zipError].filter(Boolean)
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error clearing data:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to clear data', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function runHealthCheck(supabase: any) {
  try {
    // Get ZIP codes count
    const { count: zipCount, error: zipError } = await supabase
      .from('comprehensive_zip_codes')
      .select('*', { count: 'exact', head: true });
    
    // Get ZCTA polygons count  
    const { count: zctaCount, error: zctaError } = await supabase
      .from('comprehensive_zcta_polygons')
      .select('*', { count: 'exact', head: true });
    
    return {
      comprehensive_zip_codes_count: zipCount || 0,
      comprehensive_zcta_polygons_count: zctaCount || 0,
      zip_codes_loaded: (zipCount || 0) > 0,
      zcta_polygons_loaded: (zctaCount || 0) > 0,
      overall_health: (zipCount || 0) > 0 ? 'good' : 'needs_data',
      errors: [zipError, zctaError].filter(Boolean)
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      comprehensive_zip_codes_count: 0,
      comprehensive_zcta_polygons_count: 0,
      zip_codes_loaded: false,
      zcta_polygons_loaded: false,
      overall_health: 'error',
      error: error.message
    };
  }
}