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
    console.log('Worker assignment notification requested');
    
    const { bookingId, workerId }: WorkerAssignmentRequest = await req.json();
    console.log('Request data:', { bookingId, workerId });
    
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    if (!resendKey) {
      throw new Error('Missing RESEND_API_KEY - email sending not configured');
    }
    
    console.log('Environment check passed');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Get comprehensive booking, worker, and service details
    const [{ data: booking }, { data: worker }] = await Promise.all([
      supabase.from('bookings')
        .select(`
          *,
          booking_services (
            id,
            service_name,
            quantity,
            base_price
          )
        `)
        .eq('id', bookingId)
        .single(),
      supabase.from('users').select('name, email, phone').eq('id', workerId).single()
    ]);

    if (!booking || !worker?.email) {
      console.error('Missing data:', { 
        bookingFound: !!booking, 
        workerFound: !!worker, 
        workerEmail: worker?.email 
      });
      throw new Error('Booking or worker details not found');
    }
    
    console.log('Booking and worker data found:', {
      bookingId: booking.id,
      workerName: worker.name,
      workerEmail: worker.email
    });

    // Format date and time
    const formatDate = (date: string) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    // Get customer info (handle both registered users and guests)
    let customerInfo;
    if (booking.customer_id) {
      const { data: customer } = await supabase
        .from('users')
        .select('name, email, phone, city, zip_code')
        .eq('id', booking.customer_id)
        .single();
      customerInfo = customer;
    } else {
      customerInfo = booking.guest_customer_info;
    }

    // Build services list
    const servicesList = booking.booking_services
      .map((service: any) => `${service.service_name} x${service.quantity}`)
      .join('<br>');

    // Extract special instructions and address from location_notes or guest info
    const specialInstructions = booking.location_notes || 'None specified';
    const address = customerInfo?.address || (booking.guest_customer_info?.address || 'Address not provided');
    const city = customerInfo?.city || (booking.guest_customer_info?.city || '');
    const zipCode = customerInfo?.zip_code || (booking.guest_customer_info?.zipcode || '');

    console.log('Preparing to send email to:', worker.email);
    const resend = new Resend(resendKey);
    
    const emailSubject = `NEW JOB ASSIGNMENT - ${formatDate(booking.scheduled_date)}`;
    const emailHtml = `
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
          <p style="margin: 0;">${servicesList}</p>
          <p style="margin: 5px 0 0 0;"><strong>Date & Time:</strong><br>
          ${formatDate(booking.scheduled_date)}, ${formatTime(booking.scheduled_start)}</p>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Customer Information:</h3>
          <p style="margin: 0;"><strong>Name:</strong> ${customerInfo?.name || 'Not provided'}</p>
          <p style="margin: 5px 0;"><strong>Address:</strong> ${address}</p>
          <p style="margin: 5px 0;"><strong>City:</strong> ${city}, ${zipCode}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${customerInfo?.phone || 'Not provided'}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${customerInfo?.email || 'Not provided'}</p>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Notes:</h3>
          <p style="margin: 0; background-color: #f8f9fa; padding: 15px; border-radius: 5px;">${specialInstructions}</p>
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
    `;

    try {
      console.log('Sending email with Resend...');
      const emailResponse = await resend.emails.send({
        from: 'Hero TV Mounting <bookings@herotvmounting.com>',
        to: [worker.email],
        subject: emailSubject,
        html: emailHtml,
      });

      console.log('Email sent successfully:', emailResponse);

      // Log the email send in database
      await supabase.from('email_logs').insert({
        booking_id: bookingId,
        recipient_email: worker.email,
        subject: emailSubject,
        message: emailHtml,
        status: 'sent',
        email_type: 'worker_assignment'
      });

      return new Response(JSON.stringify({
        success: true,
        emailId: emailResponse.data?.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (emailError: any) {
      console.error('Email send failed:', {
        error: emailError,
        message: emailError?.message,
        status: emailError?.status,
        code: emailError?.code
      });

      // Determine error type for watchdog
      let errorType = 'smtp_error';
      const errorMessage = emailError?.message?.toLowerCase() || '';
      
      if (errorMessage.includes('timeout')) {
        errorType = 'timeout';
      } else if (errorMessage.includes('bounce') || errorMessage.includes('invalid')) {
        errorType = 'hard_bounce';
      } else if (errorMessage.includes('server') || errorMessage.includes('5')) {
        errorType = 'server_error';
      }

      // Log the email failure
      await supabase.from('email_logs').insert({
        booking_id: bookingId,
        recipient_email: worker.email,
        subject: emailSubject,
        message: emailHtml,
        status: 'failed',
        email_type: 'worker_assignment',
        error_message: emailError.message
      });

      // Trigger watchdog for email failure
      console.log('Triggering email failure watchdog...');
      try {
        await supabase.functions.invoke('email-failure-watchdog', {
          body: {
            bookingId: bookingId,
            workerId: workerId,
            originalError: emailError.message,
            errorType: errorType
          }
        });
        console.log('Watchdog triggered successfully');
      } catch (watchdogError) {
        console.error('Failed to trigger watchdog:', watchdogError);
      }

      // Return error response
      return new Response(JSON.stringify({
        success: false,
        error: 'Email send failed - watchdog activated',
        errorType: errorType
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Function error:', {
      error: error,
      message: error?.message,
      stack: error?.stack
    });
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);