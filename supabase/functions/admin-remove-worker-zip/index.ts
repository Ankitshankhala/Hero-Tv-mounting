import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { workerId, zipcode, serviceAreaId } = await req.json()

    if (!workerId || !zipcode) {
      return new Response(
        JSON.stringify({ error: 'workerId and zipcode are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth client to verify admin access
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })

    // Service client for database operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is admin
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { data: adminUser, error: userError } = await authClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || adminUser?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Build delete query
    let deleteQuery = serviceClient
      .from('worker_service_zipcodes')
      .delete()
      .eq('worker_id', workerId)
      .eq('zipcode', zipcode)

    if (serviceAreaId) {
      deleteQuery = deleteQuery.eq('service_area_id', serviceAreaId)
    }

    // Execute deletion and get affected rows
    const { data: deletedRows, error: deleteError } = await deleteQuery.select('id, service_area_id, zipcode')

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to remove ZIP code' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!deletedRows || deletedRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'ZIP code not found for this worker' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create audit logs for each affected service area
    const auditPromises = deletedRows.map(async (deletedRow) => {
      // Get area name for audit log
      const { data: areaData } = await serviceClient
        .from('worker_service_areas')
        .select('area_name')
        .eq('id', deletedRow.service_area_id)
        .single()

      const areaName = areaData?.area_name || 'Unknown Area'

      return serviceClient
        .from('service_area_audit_logs')
        .insert({
          operation: 'remove_zipcode',
          record_id: deletedRow.service_area_id,
          table_name: 'worker_service_zipcodes',
          worker_id: workerId,
          changed_by: user.id,
          area_name: areaName,
          change_summary: `Removed zipcode ${zipcode} from area '${areaName}'`,
          old_data: { zipcode: deletedRow.zipcode, service_area_id: deletedRow.service_area_id },
          new_data: null
        })
    })

    await Promise.all(auditPromises)

    console.log(`Removed ${deletedRows.length} ZIP code entries for worker ${workerId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        removedCount: deletedRows.length,
        message: `Removed ZIP code ${zipcode} from ${deletedRows.length} service area(s)`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})