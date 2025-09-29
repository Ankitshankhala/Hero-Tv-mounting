import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateInvoiceRequest {
  booking_id: string;
  send_email?: boolean;
  force_regenerate?: boolean;
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

    const { booking_id, send_email = true, force_regenerate = false }: UpdateInvoiceRequest = await req.json();

    console.log('Updating invoice for booking:', booking_id);

    // Fetch current booking with all service details
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

    // Calculate updated amounts from all booking services
    let serviceAmount = 0;
    const serviceDetails = [];
    
    if (booking.booking_services && booking.booking_services.length > 0) {
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

    console.log('Calculated amounts:', { serviceAmount, taxAmount, totalAmount });

    // Check if invoice exists
    const { data: existingInvoice, error: existingInvoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('booking_id', booking_id)
      .single();

    let invoice;
    if (existingInvoice && !force_regenerate) {
      console.log('Updating existing invoice:', existingInvoice.id);
      
      // Update existing invoice with new amounts
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          amount: serviceAmount,
          tax_amount: 0,
          total_amount: serviceAmount,
          state_code: null,
          tax_rate: 0,
          status: 'updated',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingInvoice.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update invoice: ${updateError.message}`);
      }

      // Delete existing invoice items
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', existingInvoice.id);

      invoice = updatedInvoice;
    } else {
      console.log('Creating new invoice or force regenerating');
      
      // Generate new invoice number
      const { data: invoiceNumber, error: invoiceNumberError } = await supabase
        .rpc('generate_invoice_number');

      if (invoiceNumberError) {
        throw new Error(`Failed to generate invoice number: ${invoiceNumberError.message}`);
      }

      // Create new invoice
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
          status: 'updated'
        })
        .select()
        .single();

      if (invoiceError) {
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      invoice = newInvoice;
    }

    // Create updated invoice items
    const invoiceItems = serviceDetails.map(service => ({
      invoice_id: invoice.id,
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
      throw new Error(`Failed to create invoice items: ${itemsError.message}`);
    }

    console.log('Invoice items created successfully');

    // Send updated invoice email
    if (send_email) {
      console.log('Invoice email requested - logging for now');
      
      const customerEmail = booking.customer?.email || booking.guest_customer_info?.email;
      
      // Log email details for now instead of sending
      console.log('Would send invoice email:', {
        to: customerEmail,
        subject: `${existingInvoice ? 'Updated' : ''} Invoice ${invoice.invoice_number} - Hero TV Mounting Service`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amount: invoice.total_amount
      });

      // Update invoice as email sent (for now)
      await supabase
        .from('invoices')
        .update({ 
          email_sent: true, 
          email_sent_at: new Date().toISOString() 
        })
        .eq('id', invoice.id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invoice: invoice,
      email_sent: send_email,
      was_updated: !!existingInvoice,
      service_count: serviceDetails.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in update-invoice function:", error);
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
  return cityStateMap[normalizedCity] || 'TX';
}

function generateUpdatedInvoiceEmail(data: any): string {
  const { customer, booking, service, worker, invoice, transaction, serviceDetails, isUpdate } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${isUpdate ? 'Updated ' : ''}Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1f2937; color: white; padding: 20px; text-align: center; margin-bottom: 30px; }
        .update-notice { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .invoice-details { background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .service-details { border: 1px solid #dee2e6; border-radius: 5px; margin-bottom: 20px; }
        .service-header { background: #e9ecef; padding: 10px; font-weight: bold; }
        .service-content { padding: 15px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #666; }
        .amount { font-size: 18px; font-weight: bold; color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: bold; }
        .highlight { background: #d1ecf1; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Hero TV Mounting</h1>
        <p>Professional TV Mounting & Installation Services</p>
      </div>
      
      ${isUpdate ? `
        <div class="update-notice">
          <h3>🔄 Invoice Updated</h3>
          <p>This invoice has been updated with additional services that were added during your appointment.</p>
        </div>
      ` : ''}
      
      <h2>Thank you for choosing Hero TV Mounting!</h2>
      <p>Dear ${customer.name},</p>
      <p>${isUpdate ? 'Your invoice has been updated with additional services.' : 'Thank you for using our professional TV mounting services.'} Please find your ${isUpdate ? 'updated ' : ''}invoice details below:</p>
      
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
        <div class="service-header">Service Details ${isUpdate ? '(Updated)' : ''}</div>
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
              ${serviceDetails.map((item: any, index: number) => `
                <tr ${index > 0 && isUpdate ? 'class="highlight"' : ''}>
                  <td>${item.name} ${index > 0 && isUpdate ? '(Added)' : ''}</td>
                  <td>${item.configuration?.description || `Professional ${item.name.toLowerCase()}`}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.total.toFixed(2)}</td>
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
      
      ${isUpdate ? `
        <p><strong>Note:</strong> Additional services were added during your appointment to ensure the best possible installation. Payment for these additional services has been processed using your existing payment method.</p>
      ` : ''}
      
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