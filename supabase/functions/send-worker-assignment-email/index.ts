import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }

    console.log('Sending email notification for booking:', bookingId);

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch booking details with worker and customer information
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        worker:users!bookings_worker_id_fkey(name, email, phone),
        customer:users!bookings_customer_id_fkey(name, email, phone, city, zip_code),
        service:services(name, description)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking details: ${bookingError?.message}`);
    }

    if (!booking.worker || !booking.worker.email) {
      console.log('No worker assigned or worker email not found for booking:', bookingId);
      
      // Log the attempt
      await supabase.from('email_logs').insert({
        booking_id: bookingId,
        recipient_email: 'no-worker@placeholder.com',
        subject: 'Worker Assignment Email',
        message: 'No worker assigned or email not found',
        status: 'skipped',
        error_message: 'No worker assigned or worker email not found'
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No worker assigned or worker email not found' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Format the booking date and time
    const bookingDate = new Date(booking.scheduled_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const bookingTime = new Date(`1970-01-01T${booking.scheduled_start}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Get customer info (could be guest or registered)
    const customerInfo = booking.guest_customer_info || {
      name: booking.customer?.name,
      email: booking.customer?.email,
      phone: booking.customer?.phone,
      city: booking.customer?.city,
      zip_code: booking.customer?.zip_code
    };

    // Compose email subject and content
    const subject = `New Job Assignment - ${booking.service?.name || 'Service'} on ${bookingDate}`;
    
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #2563eb; margin-bottom: 20px;">New Job Assignment</h1>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hello ${booking.worker.name},
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            You have been assigned a new job. Here are the details:
          </p>
          
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #374151; margin-top: 0;">Job Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 30%;">Service:</td>
                <td style="padding: 8px 0;">${booking.service?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Date:</td>
                <td style="padding: 8px 0;">${bookingDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Time:</td>
                <td style="padding: 8px 0;">${bookingTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                <td style="padding: 8px 0; text-transform: capitalize;">${booking.status}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #374151; margin-top: 0;">Customer Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 30%;">Name:</td>
                <td style="padding: 8px 0;">${customerInfo.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Phone:</td>
                <td style="padding: 8px 0;">${customerInfo.phone || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                <td style="padding: 8px 0;">${customerInfo.email || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Location:</td>
                <td style="padding: 8px 0;">${customerInfo.city || 'N/A'}, ${customerInfo.zip_code || 'N/A'}</td>
              </tr>
            </table>
          </div>
          
          ${booking.location_notes ? `
          <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin-top: 0;">Location Notes</h3>
            <p style="color: #92400e; margin-bottom: 0;">${booking.location_notes}</p>
          </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
              Please log into your worker dashboard to view more details and update the job status.
            </p>
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
              If you have any questions, please contact support immediately.
            </p>
          </div>
          
          <div style="margin-top: 20px; text-align: center;">
            <p style="font-size: 12px; color: #9ca3af;">
              This is an automated message from Hero TV Mounting. Please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    `;

    // Check if Resend API key is available
    if (!Deno.env.get("RESEND_API_KEY")) {
      console.log('RESEND_API_KEY not found, logging mock email send');
      
      // Log the mock email send
      await supabase.from('email_logs').insert({
        booking_id: bookingId,
        recipient_email: booking.worker.email,
        subject: subject,
        message: 'Mock email sent (no Resend API key configured)',
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Mock email sent (no Resend API key configured)',
          mockData: {
            to: booking.worker.email,
            subject: subject,
            bookingId: bookingId
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Send the email using Resend
    const emailResponse = await resend.emails.send({
      from: 'Hero TV Mounting <noreply@herotvmounting.com>',
      to: [booking.worker.email],
      subject: subject,
      html: emailBody
    });

    if (emailResponse.error) {
      throw new Error(`Resend API error: ${emailResponse.error.message}`);
    }

    // Log successful email send
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: booking.worker.email,
      subject: subject,
      message: 'Worker assignment email sent successfully',
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        emailId: emailResponse.data?.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error sending worker assignment email:', error);

    // Try to log the error if we have the booking ID
    try {
      const { bookingId } = await req.json().catch(() => ({}));
      if (bookingId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabase.from('email_logs').insert({
          booking_id: bookingId,
          recipient_email: 'unknown',
          subject: 'Worker Assignment Email',
          message: 'Failed to send email',
          status: 'failed',
          error_message: error.message
        });
      }
    } catch (logError) {
      console.error('Failed to log email error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});