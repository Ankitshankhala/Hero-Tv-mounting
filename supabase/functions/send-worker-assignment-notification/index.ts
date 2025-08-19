import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkerAssignmentRequest {
  bookingId: string;
  workerId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, workerId }: WorkerAssignmentRequest = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check for existing worker assignment email
    const { data: existingEmail } = await supabase
      .from('email_logs')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('email_type', 'worker_assignment')
      .eq('status', 'sent')
      .maybeSingle();

    if (existingEmail) {
      return new Response(JSON.stringify({ success: true, cached: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get booking and worker details
    const [{ data: booking }, { data: worker }] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', bookingId).single(),
      supabase.from('users').select('name, email, phone').eq('id', workerId).single()
    ]);

    if (!booking || !worker?.email) {
      throw new Error('Booking or worker details not found');
    }

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const emailResponse = await resend.emails.send({
      from: "Hero TV Mounting <assignments@herotvmounting.com>",
      to: [worker.email],
      subject: `New Assignment - Booking ${bookingId}`,
      html: `<h1>New Booking Assignment</h1><p>You have been assigned to booking ${bookingId}</p>`,
    });

    // Log with proper email_type
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: worker.email,
      subject: `New Assignment - Booking ${bookingId}`,
      message: 'Worker assignment notification',
      status: 'sent',
      email_type: 'worker_assignment',
      sent_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);