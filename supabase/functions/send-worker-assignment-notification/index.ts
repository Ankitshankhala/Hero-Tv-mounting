import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookingId, workerId } = await req.json();
    
    console.log(`[WORKER-ASSIGNMENT-EMAIL] Processing notification for booking ${bookingId}, worker ${workerId}`);

    // Fetch booking and worker details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(name),
        customer:users!customer_id(name, email)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
    }

    const { data: worker, error: workerError } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', workerId)
      .single();

    if (workerError || !worker) {
      throw new Error(`Failed to fetch worker: ${workerError?.message}`);
    }

    // Check if email already sent (idempotency)
    const { data: existingLog } = await supabase
      .from('email_logs')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('recipient_email', worker.email)
      .eq('email_type', 'worker_assignment')
      .eq('status', 'sent')
      .maybeSingle();

    if (existingLog) {
      console.log('[WORKER-ASSIGNMENT-EMAIL] Email already sent, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'Email already sent', cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Resend
    const emailData = await resend.emails.send({
      from: 'Hero TV Mounting <bookings@herotvmounting.com>',
      to: [worker.email],
      subject: `New Assignment: ${booking.service.name}`,
      html: `
        <h2>New Booking Assignment</h2>
        <p>Hi ${worker.name},</p>
        <p>You have been assigned to a new booking:</p>
        <ul>
          <li><strong>Service:</strong> ${booking.service.name}</li>
          <li><strong>Date:</strong> ${booking.scheduled_date}</li>
          <li><strong>Time:</strong> ${booking.scheduled_start}</li>
          <li><strong>Customer:</strong> ${booking.customer?.name || 'Guest'}</li>
        </ul>
        <p>Please acknowledge this assignment in your dashboard.</p>
      `,
    });

    // Log email to database
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: worker.email,
      subject: `New Assignment: ${booking.service.name}`,
      message: 'Worker assignment notification',
      email_type: 'worker_assignment',
      status: 'sent',
      external_id: emailData.data?.id,
      sent_at: new Date().toISOString(),
    });

    console.log('[WORKER-ASSIGNMENT-EMAIL] Email sent successfully');

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[WORKER-ASSIGNMENT-EMAIL] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
