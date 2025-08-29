import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RescheduleRequest {
  bookingId: string;
  newDate: string;
  newTime: string;
  note?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Worker reschedule booking function started');

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
    const requestData: RescheduleRequest = await req.json();
    console.log('Reschedule request:', requestData);

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
      throw new Error('Unauthorized: You can only reschedule your own jobs');
    }

    // Validate booking status
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new Error('Cannot reschedule completed or cancelled bookings');
    }

    // Validate new date/time is in the future
    const newDateTime = new Date(`${requestData.newDate}T${requestData.newTime}`);
    if (newDateTime <= new Date()) {
      throw new Error('New appointment time must be in the future');
    }

    // Store old values for audit
    const oldDate = booking.scheduled_date;
    const oldTime = booking.scheduled_start;

    // Update booking with new date/time
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        scheduled_date: requestData.newDate,
        scheduled_start: requestData.newTime
      })
      .eq('id', requestData.bookingId);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // Add audit log
    await supabase
      .from('booking_audit_log')
      .insert({
        booking_id: requestData.bookingId,
        operation: 'rescheduled_by_worker',
        created_by: user.id,
        details: {
          old_date: oldDate,
          old_time: oldTime,
          new_date: requestData.newDate,
          new_time: requestData.newTime,
          note: requestData.note || 'No note provided'
        }
      });

    // Send customer notification
    try {
      await supabase.functions.invoke('smart-email-dispatcher', {
        body: {
          bookingId: requestData.bookingId,
          emailType: 'customer_reschedule_notice',
          source: 'worker_reschedule'
        }
      });
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
      // Don't fail the whole operation for email issues
    }

    console.log('Booking rescheduled successfully');
    return new Response(JSON.stringify({
      success: true,
      bookingId: requestData.bookingId,
      newDate: requestData.newDate,
      newTime: requestData.newTime
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in worker reschedule booking:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Rescheduling failed' 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);