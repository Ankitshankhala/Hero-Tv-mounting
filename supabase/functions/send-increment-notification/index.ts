import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { booking_id, original_amount, added_amount, new_total } = await req.json();

    console.log('[SEND-INCREMENT-NOTIFICATION] Request:', { booking_id, new_total });

    // Get booking and customer details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, booking_services(service_name, base_price, quantity)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Get customer email
    let customerEmail = '';
    let customerName = '';
    
    if (booking.customer_id) {
      const { data: customer } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', booking.customer_id)
        .single();
      
      if (customer) {
        customerEmail = customer.email;
        customerName = customer.name || 'Valued Customer';
      }
    } else if (booking.guest_customer_info) {
      customerEmail = booking.guest_customer_info.email;
      customerName = booking.guest_customer_info.name || 'Valued Customer';
    }

    if (!customerEmail) {
      throw new Error('Customer email not found');
    }

    // Get added services (recent ones)
    const addedServices = booking.booking_services
      ?.slice(-Math.ceil(added_amount / 10)) // Rough estimate of recent services
      .map((s: any) => `- ${s.service_name} (${s.quantity}x) - $${s.base_price * s.quantity}`)
      .join('\n') || 'Additional services';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Additional Services Added to Your Booking</h2>
        
        <p>Hi ${customerName},</p>
        
        <p>Good news! Your technician has added extra services to your booking.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Original Amount:</strong> $${original_amount.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Added Services:</strong> $${added_amount.toFixed(2)}</p>
          <p style="margin: 5px 0; font-size: 18px;"><strong>New Total:</strong> $${new_total.toFixed(2)}</p>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <p style="margin: 0;"><strong>Important:</strong> Your card authorization has been updated, but you won't be charged until the work is completed.</p>
        </div>
        
        <h3>Services Added:</h3>
        <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px;">${addedServices}</pre>
        
        <p>If you have any questions, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>Hero TV Mounting Team</p>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'Hero TV Mounting <no-reply@herotvmounting.com>',
      to: [customerEmail],
      subject: 'Additional Services Added to Your Booking',
      html: emailHtml,
    });

    if (emailError) {
      console.error('[SEND-INCREMENT-NOTIFICATION] Email error:', emailError);
      throw new Error('Failed to send email notification');
    }

    // Log the notification
    await supabase.from('email_logs').insert({
      booking_id,
      recipient_email: customerEmail,
      subject: 'Additional Services Added to Your Booking',
      message: 'Incremental authorization notification sent',
      status: 'sent',
      email_type: 'increment_notification'
    });

    console.log('[SEND-INCREMENT-NOTIFICATION] Email sent successfully to:', customerEmail);

    return new Response(
      JSON.stringify({ success: true, email_sent: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SEND-INCREMENT-NOTIFICATION] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send notification'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
