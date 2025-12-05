import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create user client to get the authenticated user
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const workerId = user.id;
    console.log(`Worker ${workerId} requesting to clear completed jobs`);

    // Verify user is a worker
    const { data: workerProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', workerId)
      .single();

    if (profileError || workerProfile?.role !== 'worker') {
      console.error('User is not a worker:', profileError);
      return new Response(
        JSON.stringify({ error: 'Only workers can clear jobs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find bookings to archive:
    // - payment_status IN ('captured', 'failed', 'pending') OR payment_status IS NULL
    // - NOT 'authorized' (those stay visible)
    const { data: bookingsToArchive, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, payment_status, status')
      .eq('worker_id', workerId)
      .eq('is_archived', false)
      .or('payment_status.in.(captured,failed,pending,refunded,cancelled),payment_status.is.null');

    if (fetchError) {
      console.error('Error fetching bookings:', fetchError);
      throw fetchError;
    }

    const jobsToArchive = bookingsToArchive || [];
    console.log(`Found ${jobsToArchive.length} jobs to archive for worker ${workerId}`);

    if (jobsToArchive.length === 0) {
      // Log the operation even if nothing to archive (idempotent)
      await supabaseAdmin.from('service_operation_logs').insert({
        worker_id: workerId,
        operation_type: 'clear_completed_jobs',
        status: 'success',
        duration_ms: Date.now() - startTime,
        client_info: { jobs_archived: 0, jobs_skipped: 0 }
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          archived_count: 0,
          message: 'No jobs to clear' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bookingIds = jobsToArchive.map(b => b.id);
    const now = new Date().toISOString();

    // Archive the bookings
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ 
        is_archived: true, 
        archived_at: now 
      })
      .in('id', bookingIds);

    if (updateError) {
      console.error('Error archiving bookings:', updateError);
      throw updateError;
    }

    console.log(`Successfully archived ${bookingIds.length} jobs`);

    // Log to booking_audit_log for each archived booking
    const auditLogs = jobsToArchive.map(booking => ({
      booking_id: booking.id,
      operation: 'worker_clear_completed',
      status: 'success',
      details: {
        previous_payment_status: booking.payment_status,
        previous_booking_status: booking.status,
        archived_by: workerId,
        archived_at: now
      },
      created_by: workerId
    }));

    const { error: auditError } = await supabaseAdmin
      .from('booking_audit_log')
      .insert(auditLogs);

    if (auditError) {
      console.error('Error logging to audit:', auditError);
      // Don't fail the operation for audit log errors
    }

    // Log to service_operation_logs
    const { error: opLogError } = await supabaseAdmin
      .from('service_operation_logs')
      .insert({
        worker_id: workerId,
        operation_type: 'clear_completed_jobs',
        status: 'success',
        duration_ms: Date.now() - startTime,
        client_info: { 
          jobs_archived: bookingIds.length,
          archived_booking_ids: bookingIds
        }
      });

    if (opLogError) {
      console.error('Error logging operation:', opLogError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        archived_count: bookingIds.length,
        message: `Cleared ${bookingIds.length} completed job${bookingIds.length !== 1 ? 's' : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in worker-clear-completed:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to clear jobs',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
