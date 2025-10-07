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

    const { bookingId } = await req.json();
    
    console.log(`[CUSTOMER-CONFIRMATION-EMAIL] Processing confirmation for booking ${bookingId}`);

    // Fetch booking details (handle both registered and guest customers)
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

    // Get customer email from either registered user or guest info
    const customerEmail = booking.customer?.email || booking.guest_customer_info?.email;
    const customerName = booking.customer?.name || booking.guest_customer_info?.name;

    if (!customerEmail) {
      throw new Error('Customer email not found');
    }

    // Check if email already sent (idempotency)
    const { data: existingLog } = await supabase
      .from('email_logs')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('recipient_email', customerEmail)
      .eq('email_type', 'booking_confirmation')
      .eq('status', 'sent')
      .maybeSingle();

    if (existingLog) {
      console.log('[CUSTOMER-CONFIRMATION-EMAIL] Email already sent, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'Email already sent', cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Resend
    const emailData = await resend.emails.send({
      from: 'Hero TV Mounting <bookings@herotvmounting.com>',
      to: [customerEmail],
      subject: 'Booking Confirmation - Hero TV Mounting',
      html: `
        <h2>Booking Confirmed</h2>
        <p>Hi ${customerName},</p>
        <p>Your booking has been confirmed!</p>
        <ul>
          <li><strong>Service:</strong> ${booking.service.name}</li>
          <li><strong>Date:</strong> ${booking.scheduled_date}</li>
          <li><strong>Time:</strong> ${booking.scheduled_start}</li>
          <li><strong>Status:</strong> ${booking.status}</li>
        </ul>
        <p>We'll send you updates as your booking progresses.</p>
        <p>Thank you for choosing Hero TV Mounting!</p>
      `,
    });

    // Log email to database
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: customerEmail,
      subject: 'Booking Confirmation - Hero TV Mounting',
      message: 'Customer booking confirmation',
      email_type: 'booking_confirmation',
      status: 'sent',
      external_id: emailData.data?.id,
      sent_at: new Date().toISOString(),
    });

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
