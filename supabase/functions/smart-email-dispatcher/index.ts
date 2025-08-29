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
  emailType: 'worker_assignment' | 'customer_confirmation' | 'customer_reassignment' | 'customer_reschedule_notice';
  source: 'auto_trigger' | 'manual' | 'worker_reassignment' | 'worker_reschedule';
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
      // Delegate worker assignment emails to specialized function
      console.log('[EMAIL-DISPATCHER] Delegating to send-worker-assignment-notification');
      
      const { data: assignmentResult, error: assignmentError } = await supabase.functions.invoke(
        'send-worker-assignment-notification',
        {
          body: {
            bookingId: requestData.bookingId,
            workerId: requestData.workerId,
            force: false,
            source: 'smart_email_dispatcher'
          }
        }
      );

      if (assignmentError) {
        console.error('[EMAIL-DISPATCHER] Worker assignment delegation failed:', assignmentError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to send worker assignment email',
          details: assignmentError.message
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      console.log('[EMAIL-DISPATCHER] Worker assignment delegated successfully:', assignmentResult);
      return new Response(JSON.stringify({
        success: true,
        ...assignmentResult,
        source: 'delegated_to_specialized_function'
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

    } else if (requestData.emailType === 'customer_reassignment') {
      // Handle customer reassignment notification
      console.log('[EMAIL-DISPATCHER] Sending customer reassignment notification');
      
      // Get booking and worker details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, email),
          worker:users!worker_id(name, email, phone)
        `)
        .eq('id', requestData.bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error('Booking not found for reassignment notification');
      }

      const customerEmail = booking.customer?.email || booking.guest_customer_info?.email;
      const customerName = booking.customer?.name || booking.guest_customer_info?.name;
      
      if (!customerEmail) {
        throw new Error('Customer email not found');
      }

      const { error: emailError } = await resend.emails.send({
        from: 'Hero TV Mounting <noreply@herotvmounting.com>',
        to: [customerEmail],
        subject: 'Your Technician Has Changed - Booking Update',
        html: `
          <h2>Your Technician Assignment Has Changed</h2>
          <p>Hello ${customerName},</p>
          <p>We wanted to let you know that your technician assignment has been updated:</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Updated Booking Details:</h3>
            <p><strong>New Technician:</strong> ${booking.worker?.name || 'TBD'}</p>
            <p><strong>Date:</strong> ${new Date(booking.scheduled_date + 'T' + booking.scheduled_start).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date(booking.scheduled_date + 'T' + booking.scheduled_start).toLocaleTimeString()}</p>
            <p><strong>Contact:</strong> ${booking.worker?.phone || 'Will be provided'}</p>
          </div>
          
          <p>Your appointment details remain the same, only the technician has changed. If you have any questions, please reply to this email.</p>
          
          <p>Thank you,<br>Hero TV Mounting Team</p>
        `
      });

      if (emailError) {
        throw emailError;
      }

      // Log the email
      await supabase
        .from('email_logs')
        .insert({
          booking_id: requestData.bookingId,
          recipient_email: customerEmail,
          subject: 'Your Technician Has Changed - Booking Update',
          message: 'Customer reassignment notification',
          status: 'sent',
          email_type: 'customer_reassignment'
        });

      return new Response(JSON.stringify({
        success: true,
        message: 'Customer reassignment notification sent'
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } else if (requestData.emailType === 'customer_reschedule_notice') {
      // Handle customer reschedule notification
      console.log('[EMAIL-DISPATCHER] Sending customer reschedule notification');
      
      // Get booking details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, email),
          worker:users!worker_id(name, email, phone)
        `)
        .eq('id', requestData.bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error('Booking not found for reschedule notification');
      }

      const customerEmail = booking.customer?.email || booking.guest_customer_info?.email;
      const customerName = booking.customer?.name || booking.guest_customer_info?.name;
      
      if (!customerEmail) {
        throw new Error('Customer email not found');
      }

      const { error: emailError } = await resend.emails.send({
        from: 'Hero TV Mounting <noreply@herotvmounting.com>',
        to: [customerEmail],
        subject: 'Your Appointment Time Has Changed',
        html: `
          <h2>Your Appointment Has Been Rescheduled</h2>
          <p>Hello ${customerName},</p>
          <p>Your technician has updated your appointment time:</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Updated Appointment Details:</h3>
            <p><strong>New Date:</strong> ${new Date(booking.scheduled_date + 'T' + booking.scheduled_start).toLocaleDateString()}</p>
            <p><strong>New Time:</strong> ${new Date(booking.scheduled_date + 'T' + booking.scheduled_start).toLocaleTimeString()}</p>
            <p><strong>Technician:</strong> ${booking.worker?.name || 'TBD'}</p>
            <p><strong>Contact:</strong> ${booking.worker?.phone || 'Will be provided'}</p>
          </div>
          
          <p>If this new time doesn't work for you, please reply to this email and we'll work with you to find a better time.</p>
          
          <p>Thank you,<br>Hero TV Mounting Team</p>
        `
      });

      if (emailError) {
        throw emailError;
      }

      // Log the email
      await supabase
        .from('email_logs')
        .insert({
          booking_id: requestData.bookingId,
          recipient_email: customerEmail,
          subject: 'Your Appointment Time Has Changed',
          message: 'Customer reschedule notification',
          status: 'sent',
          email_type: 'customer_reschedule_notice'
        });

      return new Response(JSON.stringify({
        success: true,
        message: 'Customer reschedule notification sent'
      }), {
        status: 200,
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