import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

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

    logStep('Fetching booking', { booking_id });
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status')
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

    // Update invoice items and totals
    logStep('Fetching invoice for booking');
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, amount, tax_amount, total_amount')
      .eq('booking_id', booking_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message}`);
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

    return new Response(
      JSON.stringify({ success: true, invoice_total: newTotal }),
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

