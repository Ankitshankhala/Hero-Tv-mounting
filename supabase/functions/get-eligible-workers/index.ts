import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  console.log('Get eligible workers function started');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const url = new URL(req.url);
    const bookingId = url.searchParams.get('bookingId');

    if (!bookingId) {
      throw new Error('bookingId parameter is required');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current user from JWT
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Get current user role and booking details
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error('User profile not found');
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Authorization check: must be current worker or admin
    if (userProfile.role !== 'admin' && booking.worker_id !== user.id) {
      throw new Error('Unauthorized: You can only view workers for your own jobs');
    }

    // Get all active workers except the current one
    const { data: workers, error: workersError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'worker')
      .eq('is_active', true)
      .neq('id', booking.worker_id)
      .order('name');

    if (workersError) {
      throw new Error(`Failed to fetch workers: ${workersError.message}`);
    }

    console.log(`Found ${workers?.length || 0} eligible workers`);
    return new Response(JSON.stringify({
      success: true,
      workers: workers || []
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in get eligible workers:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to fetch eligible workers' 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);