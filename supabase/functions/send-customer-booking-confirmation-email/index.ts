import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// Support phone number fallback
const SUPPORT_PHONE = '+1 737-272-9971';
const SUPPORT_PHONE_RAW = '+17372729971';

// Format phone number to US format: +1 (XXX) XXX-XXXX
const formatPhoneNumber = (phone: string | null | undefined, useFallback = false): string => {
  if (!phone) {
    return useFallback ? SUPPORT_PHONE : 'N/A';
  }
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Handle 10-digit US numbers
  if (digitsOnly.length === 10) {
    return `+1 (${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  
  // Handle 11-digit numbers starting with 1
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }
  
  // Return original if format doesn't match
  return phone;
};

// Get raw phone for tel: links
const getRawPhone = (phone: string | null | undefined): string => {
  if (!phone) return SUPPORT_PHONE_RAW;
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return `+${digitsOnly}`;
  return phone;
};

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
    const bookingId = body.bookingId || body.booking_id; // Support both formats
    const forceResend = body.force === true; // Allow admin force resend
    
    console.log(`[CUSTOMER-CONFIRMATION-EMAIL] Processing confirmation for booking ${bookingId}${forceResend ? ' (FORCE)' : ''}`);

    // Fetch booking details (handle both registered and guest customers)
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
        service:services(name),
        customer:users!customer_id(name, email),
        worker:users!worker_id(name, email, phone)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
    }

    // CHECK 1: Booking flag (fast check)
    if (!forceResend && booking.confirmation_email_sent === true) {
      console.log('[CUSTOMER-CONFIRMATION-EMAIL] Booking flag already set, skipping (idempotent)');
      return new Response(
        JSON.stringify({ success: true, message: 'Email already sent (booking flag)', cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get customer email from either registered user or guest info
    const customerEmail = booking.customer?.email || booking.guest_customer_info?.email;
    const customerName = booking.customer?.name || booking.guest_customer_info?.name;

    if (!customerEmail) {
      throw new Error('Customer email not found');
    }

    // Extract worker information with fallback to support number
    const workerName = booking.worker?.name || 'TBD';
    const hasWorkerPhone = !!booking.worker?.phone;
    const workerPhoneRaw = getRawPhone(booking.worker?.phone);
    const formattedWorkerPhone = formatPhoneNumber(booking.worker?.phone, true); // Use fallback
    const workerEmail = booking.worker?.email || '';
    const phoneLabel = hasWorkerPhone ? 'Worker Mobile' : 'Support Line';

    // Build service items list
    const serviceItems = booking.booking_services && booking.booking_services.length > 0
      ? booking.booking_services.map(bs => `${bs.service_name} (Qty: ${bs.quantity})`).join('<br>')
      : booking.service?.name || 'Service details unavailable';

    // Calculate total amount
    const totalAmount = booking.booking_services && booking.booking_services.length > 0
      ? booking.booking_services.reduce((sum, bs) => sum + (bs.base_price * bs.quantity), 0)
      : booking.total_price || 0;

    // Format date and time
    const scheduledDate = booking.scheduled_date 
      ? new Date(booking.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBD';
    const scheduledTime = booking.scheduled_start || 'TBD';

    // Location notes
    const locationNotes = booking.location_notes || 'No special instructions';

    console.log('[CUSTOMER-CONFIRMATION] Worker:', workerName);
    console.log('[CUSTOMER-CONFIRMATION] Worker Phone:', formattedWorkerPhone, hasWorkerPhone ? '(worker)' : '(support fallback)');
    console.log('[CUSTOMER-CONFIRMATION] Services:', serviceItems);
    console.log('[CUSTOMER-CONFIRMATION] Total:', totalAmount);

    // CHECK 2: email_logs table (secondary idempotency check)
    if (!forceResend) {
      const { data: existingLog } = await supabase
        .from('email_logs')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('recipient_email', customerEmail)
        .eq('email_type', 'booking_confirmation')
        .eq('status', 'sent')
        .maybeSingle();

      if (existingLog) {
        console.log('[CUSTOMER-CONFIRMATION-EMAIL] Email already in logs, skipping and fixing flag');
        // Fix the booking flag if it wasn't set
        await supabase.from('bookings').update({ confirmation_email_sent: true }).eq('id', bookingId);
        return new Response(
          JSON.stringify({ success: true, message: 'Email already sent (email_logs)', cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Send email via Resend
    const emailData = await resend.emails.send({
      from: 'Hero TV Mounting <bookings@herotvmounting.com>',
      to: [customerEmail],
      subject: 'Booking Confirmation - Hero TV Mounting',
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation - Hero TV Mounting</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4;">
    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; background: #1a365d; color: white; padding: 20px; margin: -30px -30px 30px -30px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Booking Confirmation - Hero TV Mounting</h1>
        </div>
        
        <p>Dear <strong>${customerName}</strong>,</p>
        
        <p>Thank you for choosing Hero TV Mounting! Your booking has been confirmed.</p>
        
        <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a8f 100%); padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; color: white;">
            <h3 style="margin: 0 0 10px 0; color: white;">📱 ${hasWorkerPhone ? 'Contact Your Worker Directly' : 'Need Assistance?'}</h3>
            ${hasWorkerPhone ? `<p style="margin: 5px 0; font-size: 18px; font-weight: bold; color: white;">${workerName}</p>` : ''}
            <a href="tel:${workerPhoneRaw}" 
               style="display: inline-block; background: #48bb78; color: white; 
                      padding: 12px 30px; margin: 10px 0; border-radius: 6px; 
                      text-decoration: none; font-weight: bold; font-size: 16px;">
              📞 Call ${formattedWorkerPhone}
            </a>
            <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; color: white;">
              ${hasWorkerPhone ? 'Feel free to call or text with any questions' : 'Call our support team for assistance'}
            </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a365d;">
            <h3 style="color: #2d3748; margin-top: 0; margin-bottom: 10px;">Booking Details:</h3>
            <p style="margin: 5px 0;"><strong style="color: #2d3748;">Booking ID:</strong> ${booking.id}</p>
            <p style="margin: 5px 0;"><strong style="color: #2d3748;">Scheduled Date:</strong> ${scheduledDate}</p>
            <p style="margin: 5px 0;"><strong style="color: #2d3748;">Scheduled Time:</strong> ${scheduledTime}</p>
            <p style="margin: 5px 0;"><strong style="color: #2d3748;">Status:</strong> ${booking.status}</p>
            <p style="margin: 5px 0;"><strong style="color: #2d3748;">Worker:</strong> ${workerName}</p>
            <p style="margin: 5px 0;"><strong style="color: #2d3748;">${phoneLabel}:</strong> <a href="tel:${workerPhoneRaw}" style="color: #1a365d; text-decoration: none; font-weight: bold;">${formattedWorkerPhone}</a></p>
        </div>
        
        <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-top: 0; margin-bottom: 10px;">Services:</h3>
            <p style="margin: 10px 0;">${serviceItems}</p>
            <p style="font-size: 18px; font-weight: bold; color: #1a365d; margin-top: 15px;"><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a365d;">
            <h3 style="color: #2d3748; margin-top: 0; margin-bottom: 10px;">Your Assigned Worker:</h3>
            <p style="margin: 5px 0;"><strong style="color: #2d3748;">Name:</strong> ${workerName}</p>
            <p style="margin: 5px 0;"><strong style="color: #2d3748;">${phoneLabel}:</strong> <a href="tel:${workerPhoneRaw}" style="color: #1a365d; text-decoration: none; font-weight: bold;">${formattedWorkerPhone}</a></p>
            ${workerEmail ? `<p style="margin: 5px 0;"><strong style="color: #2d3748;">Email:</strong> ${workerEmail}</p>` : ''}
            <p style="margin: 15px 0 5px 0;"><strong style="color: #2d3748;">Location Notes:</strong> ${locationNotes}</p>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7;">
            <h3 style="color: #2d3748; margin-top: 0; margin-bottom: 10px;">Contact Information:</h3>
            <p style="margin: 5px 0;">If you have any questions, please contact us at:</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> Captain@herotvmounting.com<br>
            <strong>Phone:</strong> +1 737-272-9971</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666;">
            <p>Thank you for your business!</p>
            <p><strong>Hero TV Mounting Team</strong></p>
        </div>
    </div>
</body>
</html>
      `,
    });

    // Log email to database
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: customerEmail,
      subject: 'Booking Confirmation - Hero TV Mounting',
      message: 'Professional booking confirmation with worker and service details',
      email_type: 'booking_confirmation',
      status: 'sent',
      external_id: emailData.data?.id,
      sent_at: new Date().toISOString(),
    });

    // UPDATE BOOKING FLAG to prevent future duplicate sends
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ confirmation_email_sent: true })
      .eq('id', bookingId);

    if (updateError) {
      console.warn('[CUSTOMER-CONFIRMATION-EMAIL] Failed to update booking flag:', updateError.message);
    } else {
      console.log('[CUSTOMER-CONFIRMATION-EMAIL] Booking flag updated: confirmation_email_sent = true');
    }

    console.log('[CUSTOMER-CONFIRMATION-EMAIL] Email sent successfully');

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[CUSTOMER-CONFIRMATION-EMAIL] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
