import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailDispatchRequest {
  bookingId: string;
  workerId?: string;
  emailType: 'worker_assignment' | 'customer_confirmation';
  source: 'auto_trigger' | 'manual';
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Smart email dispatcher triggered');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: EmailDispatchRequest = await req.json();
    console.log('Email dispatch request:', requestData);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    if (requestData.emailType === 'worker_assignment' && requestData.workerId) {
      // Handle worker assignment email
      console.log('Processing worker assignment email');
      
      // Get worker email first to check for existing sends
      const { data: worker, error: workerError } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', requestData.workerId)
        .single();

      if (workerError || !worker) {
        throw new Error(`Failed to fetch worker: ${workerError?.message}`);
      }

      // Check if email already sent using unique constraint fields
      const { data: existingEmail } = await supabase
        .from('email_logs')
        .select('id')
        .eq('booking_id', requestData.bookingId)
        .eq('recipient_email', worker.email)
        .eq('email_type', 'worker_assignment')
        .eq('status', 'sent')
        .maybeSingle();

      if (existingEmail) {
        console.log('Worker assignment email already sent');
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Email already sent',
          cached: true 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Get booking and worker details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', requestData.bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
      }

      // Worker already fetched above for duplicate check

      // Get customer info
      let customerEmail = '';
      let customerName = '';
      let customerPhone = '';

      if (booking.customer_id) {
        const { data: customer } = await supabase
          .from('users')
          .select('name, email, phone')
          .eq('id', booking.customer_id)
          .single();
        
        if (customer) {
          customerEmail = customer.email;
          customerName = customer.name || 'Customer';
          customerPhone = customer.phone || '';
        }
      } else if (booking.guest_customer_info) {
        customerEmail = booking.guest_customer_info.email || '';
        customerName = booking.guest_customer_info.name || 'Customer';
        customerPhone = booking.guest_customer_info.phone || '';
      }

      // Get booking services
      const { data: bookingServices } = await supabase
        .from('booking_services')
        .select('service_name, base_price, quantity')
        .eq('booking_id', requestData.bookingId);

      // Format scheduled date and time
      const scheduledDateTime = new Date(`${booking.scheduled_date}T${booking.scheduled_start}`);
      const formattedDate = scheduledDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = scheduledDateTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Calculate total amount
      const totalAmount = bookingServices?.reduce((sum: number, service: any) => 
        sum + (service.base_price * service.quantity), 0
      ) || 0;

      // Service details
      const serviceDetails = bookingServices?.map((service: any) => 
        `${service.service_name} (Qty: ${service.quantity}) - $${(service.base_price * service.quantity).toFixed(2)}`
      ).join('<br>') || 'Service details unavailable';

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Booking Assignment - Hero TV Mounting</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; background: #dc2626; color: white; padding: 20px; margin: -30px -30px 30px -30px; border-radius: 10px 10px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .details-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .customer-box { background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .services-box { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .urgent { background: #fee2e2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
        h2 { color: #dc2626; margin-top: 0; }
        h3 { color: #2d3748; margin-bottom: 10px; }
        .total { font-size: 18px; font-weight: bold; color: #dc2626; }
        strong { color: #2d3748; }
        .acknowledge-btn { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 New Booking Assignment</h1>
        </div>
        
        <div class="urgent">
            <h2>📋 You've been assigned a new booking!</h2>
            <p><strong>Action Required:</strong> Please acknowledge this assignment within 10 minutes.</p>
        </div>
        
        <p>Hello <strong>${worker.name}</strong>,</p>
        
        <p>You have been assigned to a new booking. Please review the details below and acknowledge your assignment.</p>
        
        <div class="details-box">
            <h3>📅 Booking Details:</h3>
            <p><strong>Booking ID:</strong> ${requestData.bookingId}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Location Notes:</strong> ${booking.location_notes || 'None provided'}</p>
        </div>
        
        <div class="customer-box">
            <h3>👤 Customer Information:</h3>
            <p><strong>Name:</strong> ${customerName}</p>
            <p><strong>Email:</strong> ${customerEmail}</p>
            <p><strong>Phone:</strong> ${customerPhone || 'Not provided'}</p>
        </div>
        
        <div class="services-box">
            <h3>🛠️ Services Requested:</h3>
            <p>${serviceDetails}</p>
            <p class="total"><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
        </div>
        
        <div class="urgent">
            <h3>⚠️ Important Notes:</h3>
            <ul>
                <li>Please acknowledge this assignment within <strong>10 minutes</strong></li>
                <li>Contact the customer to confirm arrival time</li>
                <li>Bring all necessary tools and equipment</li>
                <li>If you cannot complete this booking, notify admin immediately</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Questions? Contact admin immediately.</p>
            <p><strong>Email:</strong> admin@herotvmounting.com</p>
            <p><strong>Phone:</strong> +1 737-272-9971</p>
        </div>
    </div>
</body>
</html>
      `;

      // Send worker assignment email
      const emailResponse = await resend.emails.send({
        from: "Hero TV Mounting <assignments@herotvmounting.com>",
        to: [worker.email],
        subject: `🔧 New Booking Assignment - ${formattedDate} at ${formattedTime}`,
        html: htmlContent,
      });

      console.log('Worker assignment email sent:', emailResponse);

      // Log email with upsert to prevent duplicates
      const { error: logError } = await supabase
        .from('email_logs')
        .upsert({
          booking_id: requestData.bookingId,
          recipient_email: worker.email,
          subject: `New Booking Assignment - ${formattedDate} at ${formattedTime}`,
          message: htmlContent,
          status: 'sent',
          email_type: 'worker_assignment',
          external_id: emailResponse.data?.id,
          sent_at: new Date().toISOString()
        }, {
          onConflict: 'booking_id,recipient_email,email_type'
        });

      if (logError) {
        console.error('Failed to log email send:', logError);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id,
        emailType: 'worker_assignment'
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } else if (requestData.emailType === 'customer_confirmation') {
      // Forward to customer confirmation function
      console.log('Forwarding customer confirmation to dedicated function');
      
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-customer-booking-confirmation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ bookingId: requestData.bookingId })
        }
      );

      const result = await response.json();
      
      return new Response(JSON.stringify(result), {
        status: response.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    throw new Error('Invalid email type or missing required parameters');

  } catch (error: any) {
    console.error("Error in smart email dispatcher:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Email dispatch failed' 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);