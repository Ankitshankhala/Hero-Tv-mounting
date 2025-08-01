import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AddServiceRequest {
  booking_id: string;
  services: { service_id: string; quantity?: number }[];
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADD-BOOKING-SERVICES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id, services }: AddServiceRequest = await req.json();

    if (!booking_id || !Array.isArray(services) || services.length === 0) {
      return new Response(
        JSON.stringify({ error: 'booking_id and services are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep('Fetching booking with payment details', { booking_id });
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, payment_intent_id, payment_status')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    if (booking.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Cannot modify a completed booking' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!booking.payment_intent_id) {
      return new Response(
        JSON.stringify({ error: 'Booking has no payment intent for authorization updates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch service details for pricing
    const serviceIds = services.map((s) => s.service_id);
    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('id, name, description, base_price')
      .in('id', serviceIds);

    if (serviceError) {
      throw new Error(`Failed to fetch services: ${serviceError.message}`);
    }

    const servicesMap = new Map<string, typeof serviceData[number]>();
    for (const svc of serviceData ?? []) {
      servicesMap.set(svc.id, svc);
    }

    const bookingServices = services.map((svc) => {
      const details = servicesMap.get(svc.service_id);
      return {
        booking_id,
        service_id: svc.service_id,
        service_name: details?.name || 'Service',
        quantity: svc.quantity || 1,
        base_price: details?.base_price || 0,
        configuration: {},
      };
    });

    logStep('Inserting booking_services', { count: bookingServices.length });
    const { error: insertError } = await supabase
      .from('booking_services')
      .insert(bookingServices);

    if (insertError) {
      throw new Error(`Failed to insert booking services: ${insertError.message}`);
    }

    // Get or create invoice for the booking
    logStep('Fetching invoice for booking');
    let { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, amount, tax_amount, total_amount')
      .eq('booking_id', booking_id)
      .maybeSingle();

    if (invoiceError) {
      throw new Error(`Error fetching invoice: ${invoiceError.message}`);
    }

    // If no invoice exists, create one
    if (!invoice) {
      logStep('No invoice found, creating new invoice');
      
      // Fetch full booking details for invoice creation
      const { data: fullBooking, error: fullBookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(id, name, email, phone, city, zip_code),
          service:services(id, name, description, base_price)
        `)
        .eq('id', booking_id)
        .single();

      if (fullBookingError || !fullBooking) {
        throw new Error(`Failed to fetch booking details: ${fullBookingError?.message}`);
      }

      // Generate invoice number
      const { data: invoiceNumber, error: invoiceNumberError } = await supabase
        .rpc('generate_invoice_number');

      if (invoiceNumberError) {
        throw new Error(`Failed to generate invoice number: ${invoiceNumberError.message}`);
      }

      // Get customer's state from city (simplified mapping)
      const customerState = getStateFromCity(fullBooking.customer?.city || fullBooking.guest_customer_info?.city || '');
      
      // Calculate invoice amounts with state sales tax
      const serviceAmount = fullBooking.service?.base_price || 0;
      const { data: taxRateData } = await supabase
        .rpc('get_tax_rate_by_state', { state_abbreviation: customerState });
      const taxRate = taxRateData || 0.0625; // Default to 6.25% if state not found
      const taxAmount = serviceAmount * taxRate;
      const totalAmount = serviceAmount + taxAmount;

      // Create invoice
      const { data: newInvoice, error: newInvoiceError } = await supabase
        .from('invoices')
        .insert({
          booking_id: booking_id,
          invoice_number: invoiceNumber,
          customer_id: fullBooking.customer_id,
          amount: serviceAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          state_code: customerState,
          tax_rate: taxRate,
          status: 'draft'
        })
        .select('id, amount, tax_amount, total_amount')
        .single();

      if (newInvoiceError) {
        throw new Error(`Failed to create invoice: ${newInvoiceError.message}`);
      }

      // Create initial invoice item for the original service
      const { error: originalItemError } = await supabase
        .from('invoice_items')
        .insert({
          invoice_id: newInvoice.id,
          service_name: fullBooking.service?.name || 'TV Mounting Service',
          description: fullBooking.service?.description || 'Professional TV mounting service',
          quantity: 1,
          unit_price: serviceAmount,
          total_price: serviceAmount
        });

      if (originalItemError) {
        logStep('Warning: Failed to create original invoice item', { error: originalItemError.message });
      }

      invoice = newInvoice;
      logStep('Invoice created successfully', { invoice_id: invoice.id });
    }

    const invoiceItems = bookingServices.map((svc) => ({
      invoice_id: invoice.id,
      service_name: svc.service_name,
      description: servicesMap.get(svc.service_id)?.description || '',
      quantity: svc.quantity,
      unit_price: svc.base_price,
      total_price: svc.base_price * (svc.quantity || 1),
    }));

    logStep('Inserting invoice_items', { count: invoiceItems.length });
    const { error: itemError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemError) {
      throw new Error(`Failed to insert invoice items: ${itemError.message}`);
    }

    const newAmount =
      Number(invoice.amount) + invoiceItems.reduce((sum, item) => sum + Number(item.total_price), 0);
    const newTotal = newAmount + Number(invoice.tax_amount);

    logStep('Updating invoice totals', { invoice_id: invoice.id, newAmount, newTotal });
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ amount: newAmount, total_amount: newTotal })
      .eq('id', invoice.id);

    if (updateError) {
      throw new Error(`Failed to update invoice totals: ${updateError.message}`);
    }

    // Initialize Stripe and update payment intent amount
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const additionalAmount = invoiceItems.reduce((sum, item) => sum + Number(item.total_price), 0);
    const additionalAmountCents = Math.round(additionalAmount * 100);

    logStep('Updating Stripe payment intent', { 
      payment_intent_id: booking.payment_intent_id, 
      additional_amount_cents: additionalAmountCents 
    });

    try {
      // Get current payment intent
      const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
      const newTotalCents = paymentIntent.amount + additionalAmountCents;

      // Update payment intent amount
      const updatedPaymentIntent = await stripe.paymentIntents.update(booking.payment_intent_id, {
        amount: newTotalCents,
      });

      logStep('Payment intent updated successfully', { 
        old_amount: paymentIntent.amount, 
        new_amount: newTotalCents 
      });

      // Create transaction record for the additional authorization
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          booking_id,
          payment_intent_id: booking.payment_intent_id,
          amount: additionalAmount,
          currency: 'USD',
          status: 'authorized',
          transaction_type: 'additional_authorization',
        });

      if (transactionError) {
        logStep('Warning: Failed to create transaction record', { error: transactionError.message });
      }

    } catch (stripeError) {
      logStep('Stripe error updating payment intent', { error: stripeError.message });
      throw new Error(`Failed to update payment authorization: ${stripeError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoice_total: newTotal,
        additional_amount: additionalAmount,
        message: 'Services added and payment authorization updated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { error: message });
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to map city to state (simplified)
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
  return cityStateMap[normalizedCity] || 'TX'; // Default to Texas
}

