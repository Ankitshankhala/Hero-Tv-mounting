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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

    console.log('[UPDATE-INVOICE] Request:', { booking_id, send_email, force_regenerate });

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
    const serviceDetails: any[] = [];
    
    if (booking.booking_services && booking.booking_services.length > 0) {
      for (const service of booking.booking_services) {
        let servicePrice = Number(service.base_price) || 0;
        const config = service.configuration || {};

        // Calculate add-ons for Mount TV service
        if (service.service_name === 'Mount TV') {
          if (config.over65) servicePrice += 50;
          if (config.frameMount) servicePrice += 75;
          if (config.wallType === 'steel' || config.wallType === 'brick' || config.wallType === 'concrete') {
            servicePrice += 40;
          }
          if (config.soundbar) servicePrice += 30;
        }

        const serviceTotal = servicePrice * service.quantity;
        serviceAmount += serviceTotal;
        serviceDetails.push({
          name: service.service_name,
          base_price: servicePrice,
          quantity: service.quantity,
          total: serviceTotal,
          configuration: config
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

    // Get customer location for tax calculation
    const customerCity = booking.customer?.city || booking.guest_customer_info?.city || '';
    const stateCode = getStateFromCity(customerCity);
    
    // Fetch tax rate from state_tax_rates table
    let taxRate = 0;
    let taxAmount = 0;
    
    const { data: taxData } = await supabase
      .from('state_tax_rates')
      .select('tax_rate')
      .eq('state_code', stateCode)
      .eq('is_active', true)
      .single();

    if (taxData) {
      taxRate = taxData.tax_rate;
      taxAmount = serviceAmount * taxRate;
    }
    
    const totalAmount = serviceAmount + taxAmount;

    console.log('[UPDATE-INVOICE] Calculated amounts:', { 
      serviceAmount, 
      taxRate, 
      taxAmount, 
      totalAmount,
      stateCode 
    });

    // Check if invoice exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('booking_id', booking_id)
      .single();

    let invoice;
    let isUpdate = false;

    if (existingInvoice && !force_regenerate) {
      console.log('[UPDATE-INVOICE] Updating existing invoice:', existingInvoice.id);
      isUpdate = true;
      
      // Update existing invoice with new amounts
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          amount: serviceAmount,
          tax_amount: taxAmount,
          tax_rate: taxRate,
          total_amount: totalAmount,
          state_code: stateCode,
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
      console.log('[UPDATE-INVOICE] Creating new invoice');
      
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
          tax_amount: taxAmount,
          tax_rate: taxRate,
          total_amount: totalAmount,
          state_code: stateCode,
          status: 'draft'
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
      console.error('[UPDATE-INVOICE] Failed to create invoice items:', itemsError);
      throw new Error(`Failed to create invoice items: ${itemsError.message}`);
    }

    console.log('[UPDATE-INVOICE] Invoice items created successfully');

    // Log to invoice audit
    await supabase.from('invoice_audit_log').insert({
      invoice_id: invoice.id,
      operation: isUpdate ? 'update' : 'create',
      old_data: existingInvoice ? { amount: existingInvoice.amount, total_amount: existingInvoice.total_amount } : null,
      new_data: { amount: serviceAmount, tax_amount: taxAmount, total_amount: totalAmount },
      change_reason: isUpdate ? 'Services modified' : 'Invoice created'
    });

    // Send invoice email if requested
    let emailSent = false;
    if (send_email) {
      const customerEmail = booking.customer?.email || booking.guest_customer_info?.email;
      const customerName = booking.customer?.name || booking.guest_customer_info?.name || 'Valued Customer';
      
      if (customerEmail && RESEND_API_KEY) {
        try {
          console.log('[UPDATE-INVOICE] Sending invoice email to:', customerEmail);
          
          const emailHtml = generateUpdatedInvoiceEmail({
            customer: { 
              name: customerName, 
              email: customerEmail, 
              phone: booking.customer?.phone || booking.guest_customer_info?.phone,
              city: customerCity,
              zip_code: booking.customer?.zip_code || booking.guest_customer_info?.zip_code
            },
            booking,
            service: booking.service,
            worker: booking.worker,
            invoice,
            transaction: booking.transactions?.[0],
            serviceDetails,
            isUpdate,
            taxAmount,
            taxRate,
            stateCode
          });

          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Hero TV Mounting <invoices@herotvmounting.com>',
              to: [customerEmail],
              subject: `${isUpdate ? 'Updated ' : ''}Invoice ${invoice.invoice_number} - Hero TV Mounting Service`,
              html: emailHtml
            })
          });

          if (emailResponse.ok) {
            emailSent = true;
            console.log('[UPDATE-INVOICE] Email sent successfully');
            
            // Update invoice email status
            await supabase
              .from('invoices')
              .update({ 
                email_sent: true, 
                email_sent_at: new Date().toISOString(),
                email_attempts: (invoice.email_attempts || 0) + 1
              })
              .eq('id', invoice.id);

            // Log email
            await supabase.from('email_logs').insert({
              booking_id,
              recipient_email: customerEmail,
              subject: `${isUpdate ? 'Updated ' : ''}Invoice ${invoice.invoice_number}`,
              message: emailHtml,
              status: 'sent',
              email_type: isUpdate ? 'invoice_updated' : 'invoice_created',
              sent_at: new Date().toISOString()
            });
          } else {
            const errorText = await emailResponse.text();
            console.error('[UPDATE-INVOICE] Email send failed:', errorText);
          }
        } catch (emailError) {
          console.error('[UPDATE-INVOICE] Email error:', emailError);
        }
      } else {
        console.log('[UPDATE-INVOICE] Email skipped - no email address or API key');
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invoice: invoice,
      email_sent: emailSent,
      was_updated: isUpdate,
      service_count: serviceDetails.length,
      tax_calculated: taxAmount > 0
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("[UPDATE-INVOICE] Error:", error);
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
  const { customer, booking, service, worker, invoice, transaction, serviceDetails, isUpdate, taxAmount, taxRate, stateCode } = data;
  
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const taxPercentage = (taxRate * 100).toFixed(2);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${isUpdate ? 'Updated ' : ''}Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0 0 10px 0; font-size: 28px; }
        .header p { margin: 0; opacity: 0.9; }
        .content { padding: 30px; }
        .update-notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin-bottom: 25px; border-radius: 0 5px 5px 0; }
        .update-notice h3 { margin: 0 0 5px 0; color: #92400e; }
        .invoice-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
        .invoice-box h3 { margin: 0 0 15px 0; color: #1f2937; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        .invoice-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .invoice-row strong { color: #64748b; }
        .services-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .services-table th { background: #1f2937; color: white; padding: 12px; text-align: left; }
        .services-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        .services-table tr:nth-child(even) { background: #f8fafc; }
        .services-table .highlight { background: #fef3c7 !important; }
        .totals { background: #f8fafc; border-radius: 8px; padding: 20px; margin-top: 20px; }
        .totals .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .totals .total-row { border-top: 2px solid #1f2937; padding-top: 10px; margin-top: 10px; font-size: 18px; font-weight: bold; color: #1f2937; }
        .footer { text-align: center; padding: 25px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
        .footer p { margin: 5px 0; color: #64748b; }
        .badge { display: inline-block; background: #10b981; color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; margin-left: 8px; }
        .badge.pending { background: #f59e0b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🦸 Hero TV Mounting</h1>
          <p>Professional TV Mounting & Installation Services</p>
        </div>
        
        <div class="content">
          ${isUpdate ? `
            <div class="update-notice">
              <h3>🔄 Invoice Updated</h3>
              <p>This invoice has been updated to reflect changes to your service.</p>
            </div>
          ` : ''}
          
          <p>Dear ${customer.name},</p>
          <p>Thank you for choosing Hero TV Mounting! ${isUpdate ? 'Your invoice has been updated with the latest service details.' : 'Please find your invoice details below.'}</p>
          
          <div class="invoice-box">
            <h3>Invoice Details</h3>
            <div class="invoice-row"><strong>Invoice Number:</strong> <span>${invoice.invoice_number}</span></div>
            <div class="invoice-row"><strong>Invoice Date:</strong> <span>${formatDate(invoice.invoice_date || invoice.created_at)}</span></div>
            <div class="invoice-row"><strong>Service Date:</strong> <span>${formatDate(booking.scheduled_date)} at ${booking.local_service_time || booking.scheduled_start}</span></div>
            <div class="invoice-row"><strong>Customer:</strong> <span>${customer.name}</span></div>
            <div class="invoice-row"><strong>Email:</strong> <span>${customer.email}</span></div>
            ${customer.phone ? `<div class="invoice-row"><strong>Phone:</strong> <span>${customer.phone}</span></div>` : ''}
            ${customer.city ? `<div class="invoice-row"><strong>Location:</strong> <span>${customer.city}${customer.zip_code ? ', ' + customer.zip_code : ''}</span></div>` : ''}
            ${worker ? `<div class="invoice-row"><strong>Technician:</strong> <span>${worker.name}</span></div>` : ''}
          </div>
          
          <h3>Services ${isUpdate ? '(Updated)' : ''}</h3>
          <table class="services-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Qty</th>
                <th style="text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${serviceDetails.map((item: any, index: number) => `
                <tr ${index > 0 && isUpdate ? 'class="highlight"' : ''}>
                  <td>
                    ${item.name}
                    ${index > 0 && isUpdate ? '<span class="badge">Added</span>' : ''}
                    ${item.configuration?.description ? `<br><small style="color:#64748b">${item.configuration.description}</small>` : ''}
                  </td>
                  <td>${item.quantity}</td>
                  <td style="text-align: right;">$${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="row"><span>Subtotal:</span> <span>$${invoice.amount.toFixed(2)}</span></div>
            ${taxAmount > 0 ? `<div class="row"><span>Tax (${stateCode} ${taxPercentage}%):</span> <span>$${taxAmount.toFixed(2)}</span></div>` : ''}
            <div class="row total-row"><span>Total:</span> <span>$${invoice.total_amount.toFixed(2)}</span></div>
            ${transaction ? `
              <div class="row" style="margin-top: 15px;">
                <span>Payment Status:</span> 
                <span class="badge ${transaction.status === 'completed' ? '' : 'pending'}">${transaction.status === 'completed' ? 'Paid' : 'Pending'}</span>
              </div>
            ` : ''}
          </div>
          
          ${isUpdate ? `
            <p style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 5px; border-left: 4px solid #10b981;">
              <strong>Note:</strong> Any payment adjustments for additional services will be processed using your saved payment method.
            </p>
          ` : ''}
          
          <p style="margin-top: 25px;">Questions about your invoice? Contact us:</p>
          <ul style="color: #64748b;">
            <li>Email: Captain@herotvmounting.com</li>
            <li>Phone: +1 575-208-8997</li>
            <li>Website: www.herotvmounting.com</li>
          </ul>
        </div>
        
        <div class="footer">
          <p><strong>Hero TV Mounting</strong></p>
          <p>Professional TV Mounting & Installation Services</p>
          <p style="font-size: 12px; margin-top: 15px;">Making your entertainment setup perfect!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(handler);
