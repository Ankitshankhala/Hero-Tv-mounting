import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch booking with invoice, customer and booking services
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_date,
        scheduled_start,
        guest_customer_info,
        customer:users!bookings_customer_id_fkey(name, email),
        invoices(id, invoice_number, total_amount, pdf_url, invoice_date),
        booking_services(service_name, quantity)
      `)
      .eq('id', booking_id)
      .single();

    if (error || !booking) {
      throw new Error('Booking not found');
    }

    const customerEmail = booking.customer?.email || booking.guest_customer_info?.email;
    const customerName = booking.customer?.name || booking.guest_customer_info?.name || 'Valued Customer';

    if (!customerEmail) {
      throw new Error('Customer email not found');
    }

    const invoice = booking.invoices?.[0];
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const servicesHtml = (booking.booking_services || [])
      .map((bs: { service_name: string; quantity: number }) =>
        `<tr><td>${bs.service_name}</td><td style="text-align:center;">${bs.quantity}</td></tr>`
      )
      .join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Invoice ${invoice.invoice_number}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h1>Hero TV Mounting</h1>
          <p>Hello ${customerName},</p>
          <p>Thank you for your payment. Here is your final invoice summary:</p>
          <h2>Invoice ${invoice.invoice_number}</h2>
          <p>Invoice Date: ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align:left; border-bottom:1px solid #ccc;">Service</th>
                <th style="text-align:center; border-bottom:1px solid #ccc;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${servicesHtml}
            </tbody>
          </table>
          <p style="font-size:18px; font-weight:bold;">Total: $${invoice.total_amount.toFixed(2)}</p>
          ${invoice.pdf_url ? `<p>Download PDF: <a href="${invoice.pdf_url}">${invoice.pdf_url}</a></p>` : ''}
          <p>We appreciate your business!</p>
        </body>
      </html>
    `;

    const subject = `Invoice ${invoice.invoice_number} from Hero TV Mounting`;

    if (!Deno.env.get('RESEND_API_KEY')) {
      await supabase.from('email_logs').insert({
        booking_id,
        recipient_email: customerEmail,
        subject,
        message: 'Final invoice email (mock)',
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Mock email logged - Resend not configured' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    const emailResp = await resend.emails.send({
      from: 'Hero TV Mounting <bookings@herotvmounting.com>',
      to: [customerEmail],
      subject,
      html: emailHtml
    });

    if (emailResp.error) {
      await supabase.from('email_logs').insert({
        booking_id,
        recipient_email: customerEmail,
        subject,
        message: 'Final invoice email',
        status: 'failed',
        error_message: emailResp.error.message
      });
      throw new Error(`Failed to send email: ${emailResp.error.message}`);
    }

    await supabase.from('email_logs').insert({
      booking_id,
      recipient_email: customerEmail,
      subject,
      message: 'Final invoice email sent',
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Final invoice email sent', emailId: emailResp.data?.id, recipient: customerEmail }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in send-final-invoice-email:', error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
