import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

const logger = {
  info: (message: string, data?: any) => {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      data
    };
    console.log(JSON.stringify(logEntry));
  },
  error: (message: string, data?: any) => {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR', 
      message,
      data
    };
    console.error(JSON.stringify(logEntry));
  },
  warn: (message: string, data?: any) => {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      data
    };
    console.warn(JSON.stringify(logEntry));
  }
};

serve(async (req) => {
  logger.info('ZCTA data population function started');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    logger.info('Initialized Supabase client');

    // Call the database function to populate ZCTA data
    const { data: populateResult, error: populateError } = await supabase
      .rpc('populate_zcta_zipcodes');

    if (populateError) {
      logger.error('Failed to populate ZCTA data', { error: populateError });
      throw populateError;
    }

    logger.info('ZCTA data population completed', { 
      recordsInserted: populateResult 
    });

    // Verify the data was populated correctly
    const { data: countData, error: countError } = await supabase
      .from('zcta_zipcodes')
      .select('zcta_code', { count: 'exact' });

    if (countError) {
      logger.warn('Failed to verify ZCTA data count', { error: countError });
    } else {
      logger.info('ZCTA data verification', { 
        totalRecords: countData?.length || 0 
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'ZCTA data populated successfully',
        recordsInserted: populateResult,
        totalRecords: countData?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    logger.error('ZCTA population failed', { error: error.message });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Failed to populate ZCTA data from existing polygons'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});