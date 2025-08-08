import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    // 1) Ensure there is at least one service to reference
    const { data: existingService } = await supabase
      .from('services')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let serviceId = existingService?.id as string | null;
    if (!serviceId) {
      const { data: createdService, error: serviceErr } = await supabase
        .from('services')
        .insert({
          name: 'E2E Test Service',
          description: 'Automated test service',
          base_price: 100,
          duration_minutes: 60,
          is_active: true,
          is_visible: true,
          sort_order: 9999
        })
        .select('id')
        .single();
      if (serviceErr) throw serviceErr;
      serviceId = createdService.id;
    }

    // 2) Create a guest booking for tomorrow at 10:00
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        service_id: serviceId,
        scheduled_date: dateStr,
        scheduled_start: '10:00',
        status: 'payment_pending',
        payment_status: 'pending',
        guest_customer_info: {
          name: 'E2E Test Customer',
          email: 'e2e+test@herotvmounting.com',
          phone: '+10000000000',
          address: '123 Test St',
          zipcode: '78701',
          city: 'Austin'
        }
      })
      .select('id')
      .single();

    if (bookingErr) throw bookingErr;

    // 3) Add booking_services row
    const { error: bsErr } = await supabase
      .from('booking_services')
      .insert({
        booking_id: booking.id,
        service_id: serviceId,
        service_name: 'E2E Test Service',
        base_price: 100,
        quantity: 1,
      });
    if (bsErr) throw bsErr;

    // 4) Insert an authorized transaction (should move booking to confirmed via trigger)
    const { error: txAuthErr } = await supabase
      .from('transactions')
      .insert({
        booking_id: booking.id,
        amount: 100,
        currency: 'USD',
        status: 'authorized',
        transaction_type: 'charge',
        payment_intent_id: 'pi_e2e_test'
      });
    if (txAuthErr) throw txAuthErr;

    // 5) Insert a completed capture transaction (should trigger invoice generation)
    const { error: txCapErr } = await supabase
      .from('transactions')
      .insert({
        booking_id: booking.id,
        amount: 100,
        currency: 'USD',
        status: 'completed',
        transaction_type: 'capture',
        payment_intent_id: 'pi_e2e_test'
      });
    if (txCapErr) throw txCapErr;

    // 6) Wait briefly for async edge function invoicing trigger to run
    await new Promise((r) => setTimeout(r, 1200));

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, total_amount, invoice_number')
      .eq('booking_id', booking.id)
      .maybeSingle();
    if (invErr) throw invErr;

    return new Response(
      JSON.stringify({ success: true, booking_id: booking.id, invoice }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
