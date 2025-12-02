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

    const body = await req.json();
    const bookingId = body.bookingId || body.booking_id;
    const workerId = body.workerId || body.worker_id;
    const forceResend = body.force === true; // Allow admin force resend
    
    console.log(`[WORKER-ASSIGNMENT-EMAIL] Processing notification for booking ${bookingId}, worker ${workerId}${forceResend ? ' (FORCE)' : ''}`);

    // Fetch booking with complete details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        booking_services (
          id,
          quantity,
          service_name,
          base_price
        ),
        customer:users!customer_id(name, email, phone)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
    }

    // CHECK 1: Booking flag (fast check) - only for same worker
    if (!forceResend && booking.worker_assignment_email_sent === true && booking.worker_id === workerId) {
      console.log('[WORKER-ASSIGNMENT-EMAIL] Booking flag already set for this worker, skipping (idempotent)');
      return new Response(
        JSON.stringify({ success: true, message: 'Email already sent (booking flag)', cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: worker, error: workerError } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', workerId)
      .single();

    if (workerError || !worker) {
      throw new Error(`Failed to fetch worker: ${workerError?.message}`);
    }

    // Extract customer information (from users table or guest_customer_info)
    const guestInfo = booking.guest_customer_info || {};
    const customerInfo = {
      name: booking.customer?.name || guestInfo.name || 'Guest',
      email: booking.customer?.email || guestInfo.email || '',
      phone: booking.customer?.phone || guestInfo.phone || '',
      address: guestInfo.address || booking.address || '',
      unit: guestInfo.unit || booking.house_number || '',
      apartment: guestInfo.apartment_name || booking.apartment_name || '',
      city: guestInfo.city || booking.city || '',
      zipcode: guestInfo.zipcode || booking.zipcode || ''
    };

    // Build service items list
    const serviceItems = booking.booking_services && booking.booking_services.length > 0
      ? booking.booking_services.map(bs => `${bs.service_name} x${bs.quantity}`).join('<br>')
      : 'Service details not available';

    // Format date and time
    const scheduledDate = booking.scheduled_date 
      ? new Date(booking.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'Date TBD';
    const scheduledTime = booking.scheduled_start || 'Time TBD';

    // Extract special instructions
    const specialInstructions = booking.special_instructions || 'No special instructions provided';
    
    console.log('[WORKER-EMAIL] Service items:', serviceItems);
    console.log('[WORKER-EMAIL] Customer info:', customerInfo);
    console.log('[WORKER-EMAIL] Special instructions:', specialInstructions);

    // CHECK 2: email_logs table (secondary idempotency check)
    if (!forceResend) {
      const { data: existingLog } = await supabase
        .from('email_logs')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('recipient_email', worker.email)
        .eq('email_type', 'worker_assignment')
        .eq('status', 'sent')
        .maybeSingle();

      if (existingLog) {
        console.log('[WORKER-ASSIGNMENT-EMAIL] Email already in logs, skipping and fixing flag');
        // Fix the booking flag if it wasn't set
        await supabase.from('bookings').update({ worker_assignment_email_sent: true }).eq('id', bookingId);
        return new Response(
          JSON.stringify({ success: true, message: 'Email already sent (email_logs)', cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Send email via Resend
    const emailData = await resend.emails.send({
      from: 'Hero TV Mounting <bookings@herotvmounting.com>',
      to: [worker.email],
      subject: `NEW JOB ASSIGNMENT - ${scheduledDate}`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Job Assignment</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 24px;">NEW JOB ASSIGNMENT</h1>
        <h2 style="color: #e74c3c; margin: 0; font-size: 20px;">Hero TV Mounting</h2>
    </div>

    <div style="margin-bottom: 25px;">
        <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Worker:</h3>
        <p style="margin: 0; font-size: 18px; font-weight: bold;">${worker.name}</p>
    </div>

    <div style="margin-bottom: 25px;">
        <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Service:</h3>
        <p style="margin: 0;">${serviceItems}</p>
        <p style="margin: 5px 0 0 0;"><strong>Date & Time:</strong><br>
            ${scheduledDate}, ${scheduledTime}</p>
    </div>

    <div style="margin-bottom: 25px;">
        <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Customer Information:</h3>
        <p style="margin: 0;"><strong>Name:</strong> ${customerInfo.name}</p>
        <p style="margin: 5px 0;"><strong>Address:</strong> ${customerInfo.address}</p>
        ${customerInfo.unit ? `<p style="margin: 5px 0;"><strong>Unit:</strong> ${customerInfo.unit}</p>` : ''}
        ${customerInfo.apartment ? `<p style="margin: 5px 0;"><strong>Apartment:</strong> ${customerInfo.apartment}</p>` : ''}
        <p style="margin: 5px 0;"><strong>City:</strong> ${customerInfo.city}${customerInfo.zipcode ? `, ${customerInfo.zipcode}` : ''}</p>
        <p style="margin: 5px 0;"><strong>Phone:</strong> ${customerInfo.phone}</p>
        <p style="margin: 5px 0;"><strong>Email:</strong> ${customerInfo.email}</p>
    </div>

    <div style="margin-bottom: 25px;">
        <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Notes:</h3>
        <p style="margin: 0; background-color: #f8f9fa; padding: 15px; border-radius: 5px;">${customerInfo.address}
${customerInfo.unit ? `Unit: ${customerInfo.unit}` : ''}
${customerInfo.apartment ? `Apartment: ${customerInfo.apartment}` : ''}
Contact: ${customerInfo.name}
Phone: ${customerInfo.phone}
Email: ${customerInfo.email}
ZIP: ${customerInfo.zipcode}
Special Instructions: ${specialInstructions}</p>
    </div>

    <div style="margin-bottom: 25px;">
        <h3 style="background-color: #e67e22; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Important Reminders:</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li>Arrive 15 minutes early for setup</li>
            <li>Bring all necessary tools and equipment</li>
            <li>Contact customer if running late</li>
            <li>Complete job documentation after service</li>
        </ul>
    </div>

    <div style="background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; text-align: center;">
        <h3 style="margin: 0 0 10px 0;">Support Contact:</h3>
        <p style="margin: 5px 0;"><strong>Email:</strong> Captain@herotvmounting.com</p>
        <p style="margin: 5px 0;"><strong>Phone:</strong> +1 737-272-9971</p>
        <p style="margin: 15px 0 0 0; font-size: 18px; font-weight: bold;">Good luck with your assignment!</p>
    </div>
</body>
</html>
      `,
    });

    // Log email to database
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: worker.email,
      subject: `NEW JOB ASSIGNMENT - ${scheduledDate}`,
      message: 'Worker assignment notification with complete details',
      email_type: 'worker_assignment',
      status: 'sent',
      external_id: emailData.data?.id,
      sent_at: new Date().toISOString(),
    });

    // UPDATE BOOKING FLAG to prevent future duplicate sends
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ worker_assignment_email_sent: true })
      .eq('id', bookingId);

    if (updateError) {
      console.warn('[WORKER-ASSIGNMENT-EMAIL] Failed to update booking flag:', updateError.message);
    } else {
      console.log('[WORKER-ASSIGNMENT-EMAIL] Booking flag updated: worker_assignment_email_sent = true');
    }

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
