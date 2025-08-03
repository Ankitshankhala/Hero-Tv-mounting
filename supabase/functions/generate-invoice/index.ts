
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceRequest {
  booking_id: string;
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

    const { booking_id, send_email = true }: InvoiceRequest = await req.json();

    // Fetch booking details with customer, service information, and booking services
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(id, name, email, phone, city, zip_code),
        service:services(id, name, description, base_price, duration_minutes),
        worker:users!bookings_worker_id_fkey(id, name, email, phone),
        transactions(id, amount, status, payment_method, created_at),
        booking_services(id, service_id, service_name, base_price, quantity, configuration)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    // Check if invoice already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, email_sent')
      .eq('booking_id', booking_id)
      .single();

    let invoice;
    if (existingInvoice) {
      invoice = existingInvoice;
    } else {
      // Generate new invoice number
      const { data: invoiceNumber, error: invoiceNumberError } = await supabase
        .rpc('generate_invoice_number');

      if (invoiceNumberError) {
        throw new Error(`Failed to generate invoice number: ${invoiceNumberError.message}`);
      }

      // Calculate invoice amounts from all booking services
      let serviceAmount = 0;
      const serviceDetails = [];
      
      if (booking.booking_services && booking.booking_services.length > 0) {
        // Use detailed booking services
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
        // Fallback to main service
        serviceAmount = booking.service?.base_price || 0;
        serviceDetails.push({
          name: booking.service?.name || 'TV Mounting Service',
          base_price: serviceAmount,
          quantity: 1,
          total: serviceAmount,
          configuration: {}
        });
      }
      
      // No tax calculation - total equals service amount
      const taxRate = 0;
      const taxAmount = 0;
      const totalAmount = serviceAmount;

      // Create invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          booking_id: booking_id,
          invoice_number: invoiceNumber,
          customer_id: booking.customer_id,
          amount: serviceAmount,
          tax_amount: 0,
          total_amount: serviceAmount,
          state_code: null,
          tax_rate: 0,
          status: 'sent'
        })
        .select()
        .single();

      if (invoiceError) {
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      // Create invoice items for all services
      const invoiceItems = serviceDetails.map(service => ({
        invoice_id: newInvoice.id,
        service_name: service.name,
        description: service.configuration?.description || `Professional ${service.name.toLowerCase()}`,
        quantity: service.quantity,
        unit_price: service.base_price,
        total_price: service.total
      }));
      
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) {
        console.error('Failed to create invoice items:', itemsError);
      }

      invoice = newInvoice;
    }

    // Send email if requested and not already sent
    if (send_email && !existingInvoice?.email_sent) {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

      // Get detailed invoice with items for email
      const { data: invoiceWithItems } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items(*)
        `)
        .eq('id', invoice.id)
        .single();

      const emailHtml = generateInvoiceEmail({
        customer: booking.customer || booking.guest_customer_info,
        booking: booking,
        service: booking.service,
        worker: booking.worker,
        invoice: invoiceWithItems || invoice,
        transaction: booking.transactions?.[0],
        serviceDetails: serviceDetails
      });

      const customerEmail = booking.customer?.email || booking.guest_customer_info?.email;
      
      const { error: emailError } = await resend.emails.send({
        from: "Hero TV Mounting <noreply@herotvmounting.com>",
        to: [customerEmail],
        subject: `Invoice ${invoice.invoice_number} - Hero TV Mounting Service`,
        html: emailHtml,
      });

      if (emailError) {
        console.error('Failed to send email:', emailError);
      } else {
        // Update invoice as email sent
        await supabase
          .from('invoices')
          .update({ 
            email_sent: true, 
            email_sent_at: new Date().toISOString() 
          })
          .eq('id', invoice.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invoice: invoice,
      email_sent: send_email && !existingInvoice?.email_sent
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in generate-invoice function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function getStateFromCity(city: string): string {
  // Simplified state mapping - in production, use proper address API
  const cityStateMap: { [key: string]: string } = {
    'austin': 'TX',
    'dallas': 'TX',
    'houston': 'TX',
    'san antonio': 'TX',
    'fort worth': 'TX',
    'new york': 'NY',
    'los angeles': 'CA',
    'chicago': 'IL',
    'miami': 'FL',
    'phoenix': 'AZ',
    'philadelphia': 'PA',
    'san diego': 'CA',
    'san francisco': 'CA',
    'seattle': 'WA',
    'denver': 'CO',
    'atlanta': 'GA',
    'boston': 'MA',
    'las vegas': 'NV',
    'detroit': 'MI',
    'portland': 'OR'
  };
  
  const normalizedCity = city?.toLowerCase().trim() || '';
  return cityStateMap[normalizedCity] || 'TX'; // Default to Texas
}

function generateInvoiceEmail(data: any): string {
  const { customer, booking, service, worker, invoice, transaction, serviceDetails } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1f2937; color: white; padding: 20px; text-align: center; margin-bottom: 30px; }
        .invoice-details { background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .service-details { border: 1px solid #dee2e6; border-radius: 5px; margin-bottom: 20px; }
        .service-header { background: #e9ecef; padding: 10px; font-weight: bold; }
        .service-content { padding: 15px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #666; }
        .amount { font-size: 18px; font-weight: bold; color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Hero TV Mounting</h1>
        <p>Professional TV Mounting & Installation Services</p>
      </div>
      
      <h2>Thank you for choosing Hero TV Mounting!</h2>
      <p>Dear ${customer.name},</p>
      <p>Thank you for using our professional TV mounting services. Please find your invoice details below:</p>
      
      <div class="invoice-details">
        <h3>Invoice Details</h3>
        <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
        <p><strong>Invoice Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
        <p><strong>Service Date:</strong> ${new Date(booking.scheduled_date).toLocaleDateString()} at ${booking.scheduled_start}</p>
        <p><strong>Customer:</strong> ${customer.name}</p>
        <p><strong>Email:</strong> ${customer.email}</p>
        <p><strong>Phone:</strong> ${customer.phone || 'N/A'}</p>
        <p><strong>Service Location:</strong> ${customer.city}, ${customer.zip_code}</p>
      </div>
      
      <div class="service-details">
        <div class="service-header">Service Details</div>
        <div class="service-content">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.invoice_items || serviceDetails || [{
                name: service?.name || 'TV Mounting Service',
                description: service?.description || 'Professional TV mounting and installation',
                quantity: 1,
                total: invoice.amount
              }]).map((item: any) => `
                <tr>
                  <td>${item.service_name || item.name}</td>
                  <td>${item.description || `Professional ${(item.service_name || item.name).toLowerCase()}`}</td>
                  <td>${item.quantity}</td>
                  <td>$${(item.total_price || item.total || item.unit_price || invoice.amount).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="text-align: right; margin-top: 15px;">
            <p class="amount"><strong>Total Amount:</strong> $${invoice.amount.toFixed(2)}</p>
          </div>
          
          ${worker ? `<p><strong>Technician:</strong> ${worker.name}</p>` : ''}
          ${transaction ? `<p><strong>Payment Method:</strong> ${transaction.payment_method || 'Online Payment'}</p>` : ''}
          ${transaction ? `<p><strong>Payment Status:</strong> ${transaction.status === 'completed' ? 'Paid' : 'Pending'}</p>` : ''}
        </div>
      </div>
      
      <p>If you have any questions about this invoice or our services, please don't hesitate to contact us:</p>
      <ul>
        <li>Email: Captain@herotvmounting.com</li>
        <li>Phone: +1 737-272-9971</li>
        <li>Website: www.herotvmounting.com</li>
      </ul>
      
      <p>We appreciate your business and look forward to serving you again!</p>
      
      <div class="footer">
        <p><strong>Hero TV Mounting</strong><br>
        Professional TV Mounting & Installation Services<br>
        Making your entertainment setup perfect!</p>
      </div>
    </body>
    </html>
  `;
}

serve(handler);
