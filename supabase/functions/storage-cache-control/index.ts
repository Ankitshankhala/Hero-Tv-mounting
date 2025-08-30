import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting cache control optimization for service images...');

    // List all files in the service-images bucket
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('service-images')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (listError) {
      console.error('Error listing files:', listError);
      throw listError;
    }

    console.log(`Found ${files?.length || 0} files to process`);

    let processed = 0;
    let errors = 0;

    if (files && files.length > 0) {
      for (const file of files) {
        if (!file.name) continue;

        try {
          // Download the existing file
          const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('service-images')
            .download(file.name);

          if (downloadError) {
            console.error(`Error downloading ${file.name}:`, downloadError);
            errors++;
            continue;
          }

          // Re-upload with proper cache control
          const { error: uploadError } = await supabaseAdmin.storage
            .from('service-images')
            .upload(file.name, fileData, {
              cacheControl: '31536000', // 1 year
              upsert: true // Overwrite existing file
            });

          if (uploadError) {
            console.error(`Error re-uploading ${file.name}:`, uploadError);
            errors++;
            continue;
          }

          processed++;
          console.log(`Processed ${file.name} (${processed}/${files.length})`);

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          errors++;
        }
      }
    }

    const result = {
      success: true,
      totalFiles: files?.length || 0,
      processed,
      errors,
      message: `Cache control optimization completed. Processed ${processed} files with ${errors} errors.`
    };

    console.log('Cache control optimization completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Cache control optimization failed:', error);
    
    return new Response(JSON.stringify({
      error: 'Cache control optimization failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});