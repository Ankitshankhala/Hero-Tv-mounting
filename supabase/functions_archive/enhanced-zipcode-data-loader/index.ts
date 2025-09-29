import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LoaderRequest {
  operation: 'load_sample_data' | 'load_zcta_polygons' | 'health_check' | 'load_comprehensive_data'
  data?: any
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

    const { operation, data }: LoaderRequest = await req.json()

    switch (operation) {
      case 'health_check':
        return await handleHealthCheck(supabase)
      
      case 'load_sample_data':
        return await handleLoadSampleData(supabase)
      
      case 'load_zcta_polygons':
        return await handleLoadZctaPolygons(supabase, data)
      
      case 'load_comprehensive_data':
        return await handleLoadComprehensiveData(supabase)
      
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }

  } catch (error) {
    console.error('Error in enhanced-zipcode-data-loader:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function handleHealthCheck(supabase: any) {
  console.log('Running spatial health check...')
  
  const { data, error } = await supabase.rpc('check_spatial_health')
  
  if (error) {
    throw new Error(`Health check failed: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      health_data: data 
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function handleLoadSampleData(supabase: any) {
  console.log('Loading sample ZIP code data...')
  
  const { data, error } = await supabase.rpc('load_sample_zipcode_data')
  
  if (error) {
    throw new Error(`Sample data loading failed: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      result: data 
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function handleLoadZctaPolygons(supabase: any, polygonData: any) {
  console.log('Loading ZCTA polygons...')
  
  // Sample ZCTA polygons for major areas if no data provided
  const samplePolygons = polygonData || [
    {
      zcta5ce: "75201",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-96.8067, 32.7831],
          [-96.7970, 32.7767],
          [-96.7836, 32.7668],
          [-96.8144, 32.7669],
          [-96.8067, 32.7831]
        ]]
      },
      land_area: 1000000,
      water_area: 50000
    },
    {
      zcta5ce: "77001",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-95.3698, 29.7604],
          [-95.3698, 29.7564],
          [-95.3371, 29.7399],
          [-95.3698, 29.7604]
        ]]
      },
      land_area: 1200000,
      water_area: 30000
    }
  ]

  const { data, error } = await supabase.rpc('load_zcta_polygons_batch', {
    p_polygons: samplePolygons
  })
  
  if (error) {
    throw new Error(`ZCTA polygon loading failed: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      result: data 
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function handleLoadComprehensiveData(supabase: any) {
  console.log('Loading comprehensive ZIP code dataset...')
  
  // This would normally load from external sources like Census Bureau
  // For now, load extended sample data covering major US metropolitan areas
  const comprehensiveData = generateExtendedZipCodes()
  
  let insertedCount = 0
  const batchSize = 100
  
  for (let i = 0; i < comprehensiveData.length; i += batchSize) {
    const batch = comprehensiveData.slice(i, i + batchSize)
    
    const { data, error } = await supabase
      .from('us_zip_codes')
      .upsert(batch, { onConflict: 'zipcode' })
    
    if (error) {
      console.error(`Batch insert error for items ${i}-${i + batchSize}:`, error)
      continue
    }
    
    insertedCount += batch.length
    console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}, total: ${insertedCount}`)
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      inserted_count: insertedCount,
      total_processed: comprehensiveData.length,
      message: 'Comprehensive ZIP code data loaded successfully'
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

function generateExtendedZipCodes() {
  // Extended sample covering major US metropolitan areas
  // In production, this would come from Census Bureau or commercial providers
  return [
    // Texas - Dallas/Fort Worth
    { zipcode: "75201", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.7767, longitude: -96.7970 },
    { zipcode: "75202", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.7831, longitude: -96.8067 },
    { zipcode: "75203", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.7669, longitude: -96.8144 },
    { zipcode: "75204", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.7668, longitude: -96.7836 },
    { zipcode: "75205", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.8054, longitude: -96.7850 },
    { zipcode: "75206", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.7957, longitude: -96.7655 },
    { zipcode: "75207", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.7668, longitude: -96.8367 },
    { zipcode: "75208", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.7396, longitude: -96.8381 },
    { zipcode: "75209", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.8368, longitude: -96.8147 },
    { zipcode: "75210", city: "Dallas", state: "Texas", state_abbr: "TX", latitude: 32.7396, longitude: -96.7655 },
    
    // Texas - Houston
    { zipcode: "77001", city: "Houston", state: "Texas", state_abbr: "TX", latitude: 29.7604, longitude: -95.3698 },
    { zipcode: "77002", city: "Houston", state: "Texas", state_abbr: "TX", latitude: 29.7564, longitude: -95.3698 },
    { zipcode: "77003", city: "Houston", state: "Texas", state_abbr: "TX", latitude: 29.7399, longitude: -95.3371 },
    { zipcode: "77004", city: "Houston", state: "Texas", state_abbr: "TX", latitude: 29.7341, longitude: -95.3898 },
    { zipcode: "77005", city: "Houston", state: "Texas", state_abbr: "TX", latitude: 29.7196, longitude: -95.4104 },
    
    // Texas - Austin
    { zipcode: "78701", city: "Austin", state: "Texas", state_abbr: "TX", latitude: 30.2672, longitude: -97.7431 },
    { zipcode: "78702", city: "Austin", state: "Texas", state_abbr: "TX", latitude: 30.2599, longitude: -97.7294 },
    { zipcode: "78703", city: "Austin", state: "Texas", state_abbr: "TX", latitude: 30.2599, longitude: -97.7594 },
    { zipcode: "78704", city: "Austin", state: "Texas", state_abbr: "TX", latitude: 30.2330, longitude: -97.7594 },
    { zipcode: "78705", city: "Austin", state: "Texas", state_abbr: "TX", latitude: 30.2869, longitude: -97.7431 },
    
    // California - Los Angeles
    { zipcode: "90001", city: "Los Angeles", state: "California", state_abbr: "CA", latitude: 33.9731, longitude: -118.2479 },
    { zipcode: "90002", city: "Los Angeles", state: "California", state_abbr: "CA", latitude: 33.9500, longitude: -118.2479 },
    { zipcode: "90003", city: "Los Angeles", state: "California", state_abbr: "CA", latitude: 33.9384, longitude: -118.2728 },
    { zipcode: "90210", city: "Beverly Hills", state: "California", state_abbr: "CA", latitude: 34.1030, longitude: -118.4104 },
    { zipcode: "90211", city: "Beverly Hills", state: "California", state_abbr: "CA", latitude: 34.0836, longitude: -118.4104 },
    
    // New York
    { zipcode: "10001", city: "New York", state: "New York", state_abbr: "NY", latitude: 40.7505, longitude: -73.9934 },
    { zipcode: "10002", city: "New York", state: "New York", state_abbr: "NY", latitude: 40.7156, longitude: -73.9877 },
    { zipcode: "10003", city: "New York", state: "New York", state_abbr: "NY", latitude: 40.7314, longitude: -73.9883 },
    { zipcode: "10004", city: "New York", state: "New York", state_abbr: "NY", latitude: 40.6969, longitude: -74.0169 },
    { zipcode: "10005", city: "New York", state: "New York", state_abbr: "NY", latitude: 40.7056, longitude: -74.0088 },
    
    // Illinois - Chicago
    { zipcode: "60601", city: "Chicago", state: "Illinois", state_abbr: "IL", latitude: 41.8819, longitude: -87.6278 },
    { zipcode: "60602", city: "Chicago", state: "Illinois", state_abbr: "IL", latitude: 41.8839, longitude: -87.6421 },
    { zipcode: "60603", city: "Chicago", state: "Illinois", state_abbr: "IL", latitude: 41.8819, longitude: -87.6278 },
    { zipcode: "60604", city: "Chicago", state: "Illinois", state_abbr: "IL", latitude: 41.8712, longitude: -87.6421 },
    { zipcode: "60605", city: "Chicago", state: "Illinois", state_abbr: "IL", latitude: 41.8712, longitude: -87.6189 },
    
    // Florida - Miami
    { zipcode: "33101", city: "Miami", state: "Florida", state_abbr: "FL", latitude: 25.7743, longitude: -80.1937 },
    { zipcode: "33102", city: "Miami", state: "Florida", state_abbr: "FL", latitude: 25.7743, longitude: -80.2206 },
    { zipcode: "33109", city: "Miami Beach", state: "Florida", state_abbr: "FL", latitude: 25.7907, longitude: -80.1300 },
    { zipcode: "33139", city: "Miami Beach", state: "Florida", state_abbr: "FL", latitude: 25.7907, longitude: -80.1300 },
    { zipcode: "33140", city: "Miami Beach", state: "Florida", state_abbr: "FL", latitude: 25.7907, longitude: -80.1300 },
    
    // Washington - Seattle
    { zipcode: "98101", city: "Seattle", state: "Washington", state_abbr: "WA", latitude: 47.6062, longitude: -122.3321 },
    { zipcode: "98102", city: "Seattle", state: "Washington", state_abbr: "WA", latitude: 47.6205, longitude: -122.3212 },
    { zipcode: "98103", city: "Seattle", state: "Washington", state_abbr: "WA", latitude: 47.6740, longitude: -122.3419 },
    { zipcode: "98104", city: "Seattle", state: "Washington", state_abbr: "WA", latitude: 47.6020, longitude: -122.3321 },
    { zipcode: "98105", city: "Seattle", state: "Washington", state_abbr: "WA", latitude: 47.6625, longitude: -122.3020 }
  ]
}