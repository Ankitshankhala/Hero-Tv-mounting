#!/usr/bin/env node

/**
 * ZIP Code Implementation Test Script
 * 
 * This script tests the current ZIP code spatial functionality and 
 * demonstrates the data loading solution.
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test polygon for Dallas metropolitan area
const DALLAS_TEST_POLYGON = {
  type: "Polygon",
  coordinates: [[
    [-97.5, 32.5],   // Southwest corner
    [-96.5, 32.5],   // Southeast corner  
    [-96.5, 33.5],   // Northeast corner
    [-97.5, 33.5],   // Northwest corner
    [-97.5, 32.5]    // Close polygon
  ]]
};

// Smaller test polygon for current data
const SMALL_TEST_POLYGON = {
  type: "Polygon", 
  coordinates: [[
    [-96.85, 32.75],
    [-96.75, 32.75], 
    [-96.75, 32.85],
    [-96.85, 32.85],
    [-96.85, 32.75]
  ]]
};

async function testCurrentSystem() {
  console.log('\n🔍 Testing Current ZIP Code System...\n');
  
  try {
    // 1. Check current data counts
    console.log('1. Checking current data availability...');
    
    const { data: healthData, error: healthError } = await supabase
      .rpc('check_spatial_health');
    
    if (healthError) {
      console.error('❌ Health check failed:', healthError);
      return;
    }
    
    console.log(`   📊 ZIP Codes: ${healthData.zip_code_count || 0}`);
    console.log(`   📊 ZCTA Polygons: ${healthData.zcta_polygon_count || 0}`);
    console.log(`   📊 Overall Health: ${healthData.overall_health || 'unknown'}`);
    
    // 2. Test small area query (should work with current data)
    console.log('\n2. Testing small area spatial query...');
    
    const { data: smallAreaResult, error: smallAreaError } = await supabase
      .rpc('compute_zipcodes_for_polygon', {
        polygon_geojson: SMALL_TEST_POLYGON,
        min_overlap_percent: 0
      });
    
    if (smallAreaError) {
      console.error('❌ Small area query failed:', smallAreaError);
    } else {
      console.log(`   ✅ Small area found: ${smallAreaResult?.length || 0} ZIP codes`);
      if (smallAreaResult?.length > 0) {
        console.log(`   📍 ZIP codes: ${smallAreaResult.slice(0, 10).join(', ')}`);
      }
    }
    
    // 3. Test large area query (will show the limitation)  
    console.log('\n3. Testing large area spatial query...');
    
    const { data: largeAreaResult, error: largeAreaError } = await supabase
      .rpc('compute_zipcodes_for_polygon', {
        polygon_geojson: DALLAS_TEST_POLYGON,
        min_overlap_percent: 0
      });
    
    if (largeAreaError) {
      console.error('❌ Large area query failed:', largeAreaError);
    } else {
      console.log(`   📊 Large area found: ${largeAreaResult?.length || 0} ZIP codes`);
      console.log(`   ⚠️  Expected: 100+ ZIP codes for Dallas metro area`);
      if (largeAreaResult?.length > 0) {
        console.log(`   📍 ZIP codes: ${largeAreaResult.slice(0, 10).join(', ')}`);
      }
    }
    
    // 4. Show the problem clearly
    console.log('\n📋 Current System Analysis:');
    console.log('   ❌ Limited to 5 ZIP codes in database');
    console.log('   ❌ No ZCTA polygon boundaries'); 
    console.log('   ❌ Spatial queries return same 4-5 ZIPs regardless of area size');
    console.log('   ❌ Coverage limited to Dallas/Fort Worth only');
    
    return healthData;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function loadSampleData() {
  console.log('\n🚀 Loading Sample ZIP Code Data...\n');
  
  try {
    // Call the Edge Function to load sample data
    const { data, error } = await supabase.functions.invoke('load-complete-zipcode-data', {
      body: { 
        operation: 'both',  // Load both ZIP codes and ZCTA polygons
        source: 'sample'    // Use sample dataset
      }
    });
    
    if (error) {
      console.error('❌ Data loading failed:', error);
      return;
    }
    
    console.log('✅ Data loading completed!');
    console.log(`   📊 ZIP codes loaded: ${data.results?.zip_codes_loaded || 0}`);
    console.log(`   📊 ZCTA polygons loaded: ${data.results?.zcta_polygons_loaded || 0}`);
    
    if (data.results?.errors?.length > 0) {
      console.log('   ⚠️  Errors encountered:');
      data.results.errors.forEach(error => console.log(`      - ${error}`));
    }
    
    // Show validation results
    if (data.validation) {
      console.log('\n📋 Data Validation Results:');
      console.log(`   📊 Total ZIP codes: ${data.validation.zip_codes_count || 0}`);
      console.log(`   📊 Total ZCTA polygons: ${data.validation.zcta_polygons_count || 0}`);
      console.log(`   📊 States covered: ${data.validation.states_covered || 0}`);
      console.log(`   📊 Data completeness: ${data.validation.data_completeness || 'unknown'}`);
    }
    
    // Show spatial test results
    if (data.spatial_test) {
      console.log('\n📋 Spatial Test Results:');
      console.log(`   📊 Sample test ZIP count: ${data.spatial_test.sample_test_zipcode_count || 0}`);
      console.log(`   ✅ Sample test success: ${data.spatial_test.sample_test_success ? 'Yes' : 'No'}`);
      console.log(`   📊 Overall health: ${data.spatial_test.overall_health || 'unknown'}`);
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Sample data loading failed:', error);
  }
}

async function testImprovedSystem() {
  console.log('\n🎯 Testing Improved ZIP Code System...\n');
  
  try {
    // Wait a moment for data to be processed
    console.log('⏳ Waiting for data processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test the large area query again
    console.log('🔍 Re-testing large area spatial query...');
    
    const { data: improvedResult, error: improvedError } = await supabase
      .rpc('compute_zipcodes_for_polygon', {
        polygon_geojson: DALLAS_TEST_POLYGON,
        min_overlap_percent: 0
      });
    
    if (improvedError) {
      console.error('❌ Improved query failed:', improvedError);
    } else {
      console.log(`   ✅ Improved query found: ${improvedResult?.length || 0} ZIP codes`);
      console.log(`   📈 Improvement: ${improvedResult?.length > 5 ? 'Significant' : 'Minimal'}`);
      
      if (improvedResult?.length > 0) {
        console.log(`   📍 Sample ZIP codes: ${improvedResult.slice(0, 15).join(', ')}`);
        
        if (improvedResult.length > 15) {
          console.log(`   📍 ... and ${improvedResult.length - 15} more`);
        }
      }
    }
    
    // Final health check
    const { data: finalHealth } = await supabase.rpc('check_spatial_health');
    
    console.log('\n📋 Final System Status:');
    console.log(`   📊 ZIP codes: ${finalHealth?.zip_code_count || 0}`);
    console.log(`   📊 ZCTA polygons: ${finalHealth?.zcta_polygon_count || 0}`);
    console.log(`   📊 Overall health: ${finalHealth?.overall_health || 'unknown'}`);
    
    // Recommendations
    console.log('\n💡 Next Steps:');
    if ((finalHealth?.zip_code_count || 0) < 1000) {
      console.log('   🔄 Load complete US ZIP code dataset (~41,000 records)');
    }
    if ((finalHealth?.zcta_polygon_count || 0) < 1000) {
      console.log('   🔄 Load complete US ZCTA polygon dataset (~33,000 polygons)');
    }
    if ((finalHealth?.zip_code_count || 0) > 40000) {
      console.log('   ✅ System ready for production use');
    }
    
  } catch (error) {
    console.error('❌ Improved system test failed:', error);
  }
}

async function main() {
  console.log('🏠 Hero TV ZIP Code Implementation Test');
  console.log('=====================================');
  
  // Test current system to show the problem
  const currentHealth = await testCurrentSystem();
  
  // Only proceed with loading if we have minimal data
  if ((currentHealth?.zip_code_count || 0) < 100) {
    console.log('\n🔧 System needs data loading - proceeding with sample data...');
    
    // Load sample data
    await loadSampleData();
    
    // Test improved system
    await testImprovedSystem();
  } else {
    console.log('\n✅ System already has substantial data loaded');
    console.log('   Use the admin interface to manage and expand the dataset');
  }
  
  console.log('\n🎉 Test completed! Check the admin dashboard for detailed management.');
  console.log('   📱 Admin Interface: /admin -> ZIP Code Data Manager');
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testCurrentSystem,
  loadSampleData,
  testImprovedSystem
};
