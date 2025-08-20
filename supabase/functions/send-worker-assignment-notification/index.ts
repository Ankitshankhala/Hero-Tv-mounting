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
      throw new Error('Booking or worker details not found');
    }

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

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const emailResponse = await resend.emails.send({
      from: "Hero TV Mounting <assignments@herotvmounting.com>",
      to: [worker.email],
      subject: `NEW JOB ASSIGNMENT - ${formatDate(booking.scheduled_date)}`,
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
      `,
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