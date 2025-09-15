import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    switch (action) {
      case 'eligible-workers':
        return await getEligibleWorkers(req, supabase, user, userProfile);
      case 'worker-bookings':
        return await getWorkerBookings(req, supabase, user);
      case 'approve-worker':
        return await approveWorker(req, supabase, userProfile);
      default:
        throw new Error('Invalid action');
    }
  } catch (error: any) {
    console.error("Error in worker operations:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Operation failed' 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

async function getEligibleWorkers(req: Request, supabase: any, user: any, userProfile: any) {
  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId');

  if (!bookingId) {
    throw new Error('bookingId parameter is required');
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

  // Authorization check
  if (userProfile.role !== 'admin' && booking.worker_id !== user.id) {
    throw new Error('Unauthorized: You can only view workers for your own jobs');
  }

  // Get all active workers except the current one (if any)
  let query = supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'worker')
    .eq('is_active', true)
    .order('name');
  
  if (booking.worker_id) {
    query = query.neq('id', booking.worker_id);
  }
  
  const { data: workers, error: workersError } = await query;

  if (workersError) {
    throw new Error(`Failed to fetch workers: ${workersError.message}`);
  }

  return new Response(JSON.stringify({
    success: true,
    workers: workers || []
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function getWorkerBookings(req: Request, supabase: any, user: any) {
  const url = new URL(req.url);
  const includeHidden = url.searchParams.get('include_hidden') === 'true';

  // Get all bookings for this worker
  let query = supabase
    .from('bookings')
    .select(`
      *,
      booking_services(*),
      transactions(*),
      worker_booking_preferences!left(is_hidden, hidden_at)
    `)
    .eq('worker_id', user.id)
    .in('status', ['confirmed', 'completed', 'payment_authorized'])
    .order('created_at', { ascending: false });

  const { data: bookings, error: bookingsError } = await query;

  if (bookingsError) {
    throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
  }

  // Filter out hidden bookings unless explicitly requested
  let filteredBookings = bookings || [];
  
  if (!includeHidden) {
    filteredBookings = bookings?.filter(booking => {
      return !booking.worker_booking_preferences?.some(pref => pref.is_hidden);
    }) || [];
  }

  // Calculate totals for each booking
  const enrichedBookings = filteredBookings.map(booking => {
    const totalServicePrice = booking.booking_services?.reduce((sum, service) => {
      return sum + (service.base_price * service.quantity);
    }, 0) || 0;

    const latestTransaction = booking.transactions?.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    return {
      ...booking,
      total_service_price: totalServicePrice,
      latest_transaction: latestTransaction,
      is_hidden: booking.worker_booking_preferences?.some(pref => pref.is_hidden) || false
    };
  });

  return new Response(JSON.stringify({
    success: true,
    bookings: enrichedBookings,
    total_count: enrichedBookings.length,
    hidden_count: (bookings || []).filter(b => 
      b.worker_booking_preferences?.some(pref => pref.is_hidden)
    ).length
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function approveWorker(req: Request, supabase: any, userProfile: any) {
  // Only admins can approve workers
  if (userProfile.role !== 'admin') {
    throw new Error('Unauthorized: Only admins can approve workers');
  }

  const { applicationId } = await req.json();
  if (!applicationId) {
    throw new Error('Application ID is required');
  }

  // Get application
  const { data: application, error: appError } = await supabase
    .from('worker_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (appError || !application) {
    throw new Error('Application not found');
  }

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', application.email)
    .maybeSingle();

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const existingAuthUser = authUsers.users.find(user => user.email === application.email);

  let workerId: string;
  let temporaryPassword: string | null = null;

  if (existingUser) {
    // Update existing user
    workerId = existingUser.id;
    await supabase
      .from('users')
      .update({
        name: application.name,
        phone: application.phone,
        city: application.city,
        zip_code: application.zip_code,
        role: 'worker',
        is_active: true,
      })
      .eq('id', existingUser.id);

  } else if (existingAuthUser) {
    // User exists in auth but not in users table
    workerId = existingAuthUser.id;
    
    temporaryPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 58])
      .join('');

    await supabase.auth.admin.updateUserById(existingAuthUser.id, {
      password: temporaryPassword
    });

    await supabase
      .from('users')
      .insert({
        id: existingAuthUser.id,
        email: application.email,
        name: application.name,
        phone: application.phone,
        city: application.city,
        zip_code: application.zip_code,
        role: 'worker',
        is_active: true,
      });

  } else {
    // Create completely new user
    temporaryPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 58])
      .join('');

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: application.email,
      password: temporaryPassword,
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`);
    }

    workerId = authData.user.id;

    await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: application.email,
        name: application.name,
        phone: application.phone,
        city: application.city,
        zip_code: application.zip_code,
        role: 'worker',
        is_active: true,
      });
  }

  // Update application status
  await supabase
    .from('worker_applications')
    .update({ status: 'approved' })
    .eq('id', applicationId);

  return new Response(JSON.stringify({
    success: true,
    message: 'Worker application approved successfully',
    workerId,
    ...(temporaryPassword ? { temporaryPassword } : {})
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(handler);