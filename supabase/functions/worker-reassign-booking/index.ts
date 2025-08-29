import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReassignRequest {
  bookingId: string;
  newWorkerId: string;
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Worker reassign booking function started');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const requestData: ReassignRequest = await req.json();
    console.log('Reassign request:', requestData);

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
      .eq('id', requestData.bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Authorization check: must be current worker or admin
    if (userProfile.role !== 'admin' && booking.worker_id !== user.id) {
      throw new Error('Unauthorized: You can only reassign your own jobs');
    }

    // Validate booking status
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new Error('Cannot reassign completed or cancelled bookings');
    }

    // Validate new worker exists and is active
    const { data: newWorker, error: workerError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', requestData.newWorkerId)
      .eq('role', 'worker')
      .eq('is_active', true)
      .single();

    if (workerError || !newWorker) {
      throw new Error('New worker not found or inactive');
    }

    // Update booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        worker_id: requestData.newWorkerId,
        status: 'confirmed'
      })
      .eq('id', requestData.bookingId);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // Update previous worker_bookings record
    await supabase
      .from('worker_bookings')
      .update({ status: 'reassigned' })
      .eq('booking_id', requestData.bookingId)
      .eq('worker_id', booking.worker_id);

    // Create new worker_bookings record
    await supabase
      .from('worker_bookings')
      .insert({
        booking_id: requestData.bookingId,
        worker_id: requestData.newWorkerId,
        status: 'assigned',
        ack_status: 'pending'
      });

    // Add audit log
    await supabase
      .from('booking_audit_log')
      .insert({
        booking_id: requestData.bookingId,
        operation: 'reassigned_by_worker',
        created_by: user.id,
        details: {
          old_worker_id: booking.worker_id,
          new_worker_id: requestData.newWorkerId,
          reason: requestData.reason || 'No reason provided'
        }
      });

    // Send notifications
    try {
      // Notify new worker
      await supabase.functions.invoke('smart-email-dispatcher', {
        body: {
          bookingId: requestData.bookingId,
          workerId: requestData.newWorkerId,
          emailType: 'worker_assignment',
          source: 'worker_reassignment'
        }
      });

      // Notify customer of reassignment
      await supabase.functions.invoke('smart-email-dispatcher', {
        body: {
          bookingId: requestData.bookingId,
          emailType: 'customer_reassignment',
          source: 'worker_reassignment'
        }
      });
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
      // Don't fail the whole operation for email issues
    }

    console.log('Booking reassigned successfully');
    return new Response(JSON.stringify({
      success: true,
      bookingId: requestData.bookingId,
      newWorkerId: requestData.newWorkerId,
      newWorkerName: newWorker.name
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in worker reassign booking:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Reassignment failed' 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);