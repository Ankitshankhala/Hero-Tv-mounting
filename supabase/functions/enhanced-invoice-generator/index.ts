import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnhancedInvoiceRequest {
  booking_id: string;
  transaction_id?: string;
  trigger_source?: string;
  send_email?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { booking_id, transaction_id, trigger_source = 'manual', send_email = true }: EnhancedInvoiceRequest = await req.json();
    
    console.log(`Enhanced invoice generation started for booking ${booking_id} (trigger: ${trigger_source})`);

    // Check for existing invoice with idempotency
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, email_sent, delivery_status')
      .eq('booking_id', booking_id)
      .maybeSingle();

    if (existingInvoice && existingInvoice.delivery_status === 'delivered') {
      console.log(`Invoice already exists and delivered for booking ${booking_id}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Invoice already exists and delivered',
        invoice_id: existingInvoice.id 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch comprehensive booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(id, name, email, phone, city, zip_code),
        service:services(id, name, description, base_price, duration_minutes),
        worker:users!bookings_worker_id_fkey(id, name, email, phone),
        transactions(id, amount, status, payment_method, payment_intent_id, created_at, captured_at),
        booking_services(id, service_id, service_name, base_price, quantity, configuration)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    // Get the specific completed transaction
    const completedTransaction = transaction_id 
      ? booking.transactions.find(t => t.id === transaction_id)
      : booking.transactions.find(t => t.status === 'completed') || booking.transactions[0];

    if (!completedTransaction) {
      throw new Error('No completed transaction found for invoice generation');
    }

    let invoice;
    if (existingInvoice) {
      invoice = existingInvoice;
    } else {
      // Generate new invoice
      const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');
      
      // Calculate comprehensive service amounts
      let serviceAmount = 0;
      const serviceDetails = [];
      
      if (booking.booking_services?.length > 0) {
        for (const service of booking.booking_services) {
          const serviceTotal = service.base_price * service.quantity;
          serviceAmount += serviceTotal;
          serviceDetails.push({
            name: service.service_name,
            base_price: service.base_price,
            quantity: service.quantity,
            total: serviceTotal,
            configuration: service.configuration
          });
        }
      } else {
        serviceAmount = booking.service?.base_price || completedTransaction.amount;
        serviceDetails.push({
          name: booking.service?.name || 'Professional Service',
          base_price: serviceAmount,
          quantity: 1,
          total: serviceAmount,
          configuration: {}
        });
      }
      
      // Include any additional charges from pending payments
      const totalAmount = completedTransaction.amount;

      // Create enhanced invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          booking_id: booking_id,
          invoice_number: invoiceNumber,
          customer_id: booking.customer_id,
          amount: totalAmount,
          tax_amount: 0,
          total_amount: totalAmount,
          status: 'sent',
          delivery_status: 'pending'
        })
        .select()
        .single();

      if (invoiceError) {
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      // Create detailed invoice items
      const invoiceItems = serviceDetails.map(service => ({
        invoice_id: newInvoice.id,
        service_name: service.name,
        description: generateServiceDescription(service),
        quantity: service.quantity,
        unit_price: service.base_price,
        total_price: service.total
      }));
      
      await supabase.from('invoice_items').insert(invoiceItems);
      invoice = newInvoice;
    }

    // Generate and send enhanced email with PDF
    if (send_email) {
      const success = await sendEnhancedInvoiceEmail(
        supabase, 
        booking, 
        invoice, 
        completedTransaction, 
        serviceDetails
      );

      if (success) {
        await supabase
          .from('invoices')
          .update({ 
            email_sent: true, 
            email_sent_at: new Date().toISOString(),
            delivery_status: 'delivered',
            delivery_attempts: (invoice.delivery_attempts || 0) + 1,
            last_delivery_attempt: new Date().toISOString()
          })
          .eq('id', invoice.id);
      }
    }

    console.log(`Enhanced invoice generation completed for booking ${booking_id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      invoice: invoice,
      email_sent: send_email,
      trigger_source: trigger_source
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in enhanced-invoice-generator:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function sendEnhancedInvoiceEmail(
  supabase: any, 
  booking: any, 
  invoice: any, 
  transaction: any, 
  serviceDetails: any[]
): Promise<boolean> {
  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    // Get full invoice data
    const { data: invoiceWithItems } = await supabase
      .from('invoices')
      .select(`*, invoice_items(*)`)
      .eq('id', invoice.id)
      .single();

    const customerEmail = booking.customer?.email || booking.guest_customer_info?.email;
    if (!customerEmail) {
      throw new Error('No customer email found');
    }

    const emailHtml = generateEnhancedInvoiceEmail({
      customer: booking.customer || booking.guest_customer_info,
      booking: booking,
      service: booking.service,
      worker: booking.worker,
      invoice: invoiceWithItems || invoice,
      transaction: transaction,
      serviceDetails: serviceDetails
    });

    // Generate PDF attachment
    const pdfResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-invoice-pdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ booking_id: booking.id })
    });

    let attachments = [];
    if (pdfResponse.ok) {
      const pdfBuffer = await pdfResponse.arrayBuffer();
      attachments.push({
        filename: `invoice-${invoice.invoice_number}.pdf`,
        content: Array.from(new Uint8Array(pdfBuffer)),
      });
    }

    const { error: emailError } = await resend.emails.send({
      from: "Hero TV Mounting <invoices@herotvmounting.com>",
      to: [customerEmail],
      subject: `Invoice ${invoice.invoice_number} - Payment Confirmed - Hero TV Mounting`,
      html: emailHtml,
      attachments: attachments
    });

    if (emailError) {
      console.error('Failed to send enhanced email:', emailError);
      return false;
    }

    console.log(`Enhanced invoice email sent successfully to ${customerEmail}`);
    return true;

  } catch (error) {
    console.error('Error sending enhanced invoice email:', error);
    return false;
  }
}

function generateServiceDescription(service: any): string {
  const baseName = service.name;
  const config = service.configuration || {};
  
  let description = `Professional ${baseName.toLowerCase()}`;
  
  // Add configuration details if available
  if (config.wall_type) {
    description += ` on ${config.wall_type} wall`;
  }
  if (config.mount_type) {
    description += ` with ${config.mount_type} mount`;
  }
  if (config.tv_size) {
    description += ` for ${config.tv_size}" TV`;
  }
  
  return description;
}

function generateEnhancedInvoiceEmail(data: any): string {
  const { customer, booking, service, worker, invoice, transaction, serviceDetails } = data;
  
  const paymentDate = transaction.captured_at || transaction.created_at;
  const paymentMethod = transaction.payment_method || 'Online Payment';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoice.invoice_number} - Payment Confirmed</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
        .container { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1f2937, #374151); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .header p { margin: 5px 0 0 0; font-size: 16px; opacity: 0.9; }
        .payment-confirmed { background: #22c55e; color: white; padding: 15px; text-align: center; font-weight: 600; font-size: 18px; }
        .content { padding: 30px; }
        .invoice-details { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #22c55e; }
        .detail-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .detail-label { font-weight: 600; color: #555; }
        .service-details { border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0; overflow: hidden; }
        .service-header { background: #f3f4f6; padding: 15px; font-weight: 600; font-size: 18px; }
        .service-content { padding: 20px; }
        .payment-info { background: #eff6ff; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #3b82f6; }
        .total-amount { background: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
        .total-amount .amount { font-size: 24px; font-weight: 700; }
        .footer { text-align: center; margin-top: 30px; padding: 30px 20px; background: #f8f9fa; color: #666; border-top: 1px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f8f9fa; font-weight: 600; color: #374151; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .badge-success { background: #dcfce7; color: #166534; }
        .cta-button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏠 Hero TV Mounting</h1>
          <p>Professional TV Mounting & Installation Services</p>
        </div>
        
        <div class="payment-confirmed">
          ✅ Payment Confirmed - Invoice Generated
        </div>
        
        <div class="content">
          <h2>Thank you for your payment, ${customer.name}!</h2>
          <p>Your payment has been successfully processed and your service is now complete. Please find your official invoice attached to this email and detailed below.</p>
          
          <div class="invoice-details">
            <h3>📋 Invoice Details</h3>
            <div class="detail-row">
              <span class="detail-label">Invoice Number:</span>
              <span><strong>${invoice.invoice_number}</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Invoice Date:</span>
              <span>${new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Service Date:</span>
              <span>${new Date(booking.scheduled_date).toLocaleDateString()} at ${booking.scheduled_start}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Customer:</span>
              <span>${customer.name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Service Location:</span>
              <span>${customer.city}, ${customer.zip_code}</span>
            </div>
          </div>
          
          <div class="service-details">
            <div class="service-header">🔧 Service Details</div>
            <div class="service-content">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${(invoice.invoice_items || serviceDetails || [{
                    name: service?.name || 'Professional Service',
                    description: service?.description || 'Professional service completion',
                    quantity: 1,
                    total: invoice.amount
                  }]).map((item: any) => `
                    <tr>
                      <td><strong>${item.service_name || item.name}</strong></td>
                      <td>${item.description || `Professional ${(item.service_name || item.name).toLowerCase()}`}</td>
                      <td>${item.quantity}</td>
                      <td>$${(item.total_price || item.total || item.unit_price || invoice.amount).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              ${worker ? `<p><strong>👷 Technician:</strong> ${worker.name}</p>` : ''}
            </div>
          </div>
          
          <div class="payment-info">
            <h3>💳 Payment Information</h3>
            <div class="detail-row">
              <span class="detail-label">Payment Method:</span>
              <span>${paymentMethod}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment Date:</span>
              <span>${new Date(paymentDate).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment Status:</span>
              <span><span class="badge badge-success">Paid in Full</span></span>
            </div>
            ${transaction.payment_intent_id ? `
            <div class="detail-row">
              <span class="detail-label">Transaction ID:</span>
              <span>${transaction.payment_intent_id.substring(0, 20)}...</span>
            </div>
            ` : ''}
          </div>
          
          <div class="total-amount">
            <div>Total Amount Paid</div>
            <div class="amount">$${invoice.amount.toFixed(2)}</div>
          </div>
          
          <p><strong>📎 Invoice PDF:</strong> A printable PDF copy of this invoice is attached to this email for your records.</p>
          
          <h3>📞 Need Help?</h3>
          <p>If you have any questions about this invoice or our services, please don't hesitate to contact us:</p>
          <ul>
            <li><strong>Email:</strong> Captain@herotvmounting.com</li>
            <li><strong>Phone:</strong> +1 737-272-9971</li>
            <li><strong>Website:</strong> www.herotvmounting.com</li>
          </ul>
          
          <p>⭐ <strong>Enjoyed our service?</strong> We'd love to hear about your experience! Please consider leaving us a review.</p>
        </div>
        
        <div class="footer">
          <p><strong>Hero TV Mounting</strong><br>
          Professional TV Mounting & Installation Services<br>
          Making your entertainment setup perfect!<br><br>
          <small>This invoice was automatically generated upon payment confirmation.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(handler);