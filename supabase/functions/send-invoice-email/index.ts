import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { booking_id, recipient_email, invoice_id } = await req.json();

    console.log(`[SEND-INVOICE-EMAIL] Processing invoice email for booking: ${booking_id}`);

    // Fetch invoice and booking details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        booking:bookings!invoices_booking_id_fkey(
          scheduled_date,
          scheduled_start,
          service:services(name),
          customer:users!bookings_customer_id_fkey(name, email),
          guest_customer_info
        ),
        invoice_items(*)
      `)
      .eq('booking_id', booking_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message || 'Unknown error'}`);
    }

    // Determine customer information
    const customerName = invoice.booking.customer_id 
      ? invoice.booking.customer?.name || 'Customer'
      : invoice.booking.guest_customer_info?.name || 'Guest Customer';

    const customerEmail = recipient_email || (invoice.booking.customer_id 
      ? invoice.booking.customer?.email
      : invoice.booking.guest_customer_info?.email);

    if (!customerEmail) {
      throw new Error('No customer email found');
    }

    // Generate email HTML
    const emailHtml = generateInvoiceEmailHtml({
      customerName,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: new Date(invoice.invoice_date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      serviceDate: new Date(invoice.booking.scheduled_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      serviceName: invoice.booking.service?.name || 'Service',
      items: invoice.invoice_items || [],
      subtotal: Number(invoice.amount),
      taxRate: Number(invoice.tax_rate || 0),
      taxAmount: Number(invoice.tax_amount),
      total: Number(invoice.total_amount),
      status: invoice.status
    });

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: 'Hero TV Mounting <invoices@herotvmounting.com>',
      to: [customerEmail],
      subject: `Invoice ${invoice.invoice_number} - Hero TV Mounting`,
      html: emailHtml,
    });

    if (emailResponse.error) {
      throw new Error(`Resend error: ${emailResponse.error.message}`);
    }

    console.log('[SEND-INVOICE-EMAIL] Email sent successfully:', emailResponse.data?.id);

    // Log email in email_logs table
    await supabase.from('email_logs').insert({
      booking_id: booking_id,
      recipient_email: customerEmail,
      subject: `Invoice ${invoice.invoice_number} - Hero TV Mounting`,
      message: `Invoice email sent for ${invoice.invoice_number}`,
      email_type: 'invoice',
      status: 'sent',
      sent_at: new Date().toISOString(),
      external_id: emailResponse.data?.id
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invoice email sent successfully',
        email_id: emailResponse.data?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[SEND-INVOICE-EMAIL] Error:', error);
    
    // Log failed email attempt
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { booking_id, recipient_email } = await req.json();
      
      await supabase.from('email_logs').insert({
        booking_id: booking_id,
        recipient_email: recipient_email || 'unknown',
        subject: 'Invoice Email',
        message: 'Invoice email send failed',
        email_type: 'invoice',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.error('[SEND-INVOICE-EMAIL] Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function generateInvoiceEmailHtml(data: {
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  serviceDate: string;
  serviceName: string;
  items: Array<{ service_name: string; quantity: number; unit_price: number; total_price: number }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: string;
}): string {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.service_name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.unit_price.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${item.total_price.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${data.invoiceNumber}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #2563eb;">
        <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Hero TV Mounting</h1>
        <p style="color: #6b7280; margin: 5px 0 0 0;">Professional TV Mounting Services</p>
      </div>

      <!-- Invoice Info -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Invoice ${data.invoiceNumber}</h2>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Invoice Date:</strong></td>
              <td style="padding: 8px 0; text-align: right;">${data.invoiceDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Service Date:</strong></td>
              <td style="padding: 8px 0; text-align: right;">${data.serviceDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Customer:</strong></td>
              <td style="padding: 8px 0; text-align: right;">${data.customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Status:</strong></td>
              <td style="padding: 8px 0; text-align: right;">
                <span style="background-color: ${data.status === 'paid' ? '#10b981' : '#f59e0b'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                  ${data.status}
                </span>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Line Items -->
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1f2937; margin: 0 0 15px 0;">Services</h3>
        <table style="width: 100%; border-collapse: collapse; background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #4b5563;">Service</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #4b5563;">Qty</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #4b5563;">Unit Price</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #4b5563;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style="margin-bottom: 30px;">
        <table style="width: 100%; max-width: 300px; margin-left: auto; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; text-align: right; color: #6b7280;">Subtotal:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; width: 100px;">$${data.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; text-align: right; color: #6b7280;">Tax (${(data.taxRate * 100).toFixed(2)}%):</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">$${data.taxAmount.toFixed(2)}</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: 700; color: #1f2937;">Total:</td>
            <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: 700; color: #2563eb;">$${data.total.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <!-- Payment Notice -->
      ${data.status !== 'paid' ? `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 30px; border-radius: 4px;">
        <p style="margin: 0; color: #92400e; font-weight: 600;">Payment Pending</p>
        <p style="margin: 8px 0 0 0; color: #78350f; font-size: 14px;">Please contact us if you have any questions about this invoice.</p>
      </div>
      ` : `
      <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 30px; border-radius: 4px;">
        <p style="margin: 0; color: #065f46; font-weight: 600;">✓ Payment Received</p>
        <p style="margin: 8px 0 0 0; color: #047857; font-size: 14px;">Thank you for your business!</p>
      </div>
      `}

      <!-- Footer -->
      <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        <p style="margin: 0 0 10px 0;">Hero TV Mounting</p>
        <p style="margin: 0 0 10px 0;">Professional TV Installation Services</p>
        <p style="margin: 0;">Questions? Contact us at support@herotvmounting.com</p>
      </div>

    </body>
    </html>
  `;
}
