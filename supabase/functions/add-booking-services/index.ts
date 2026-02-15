import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/stripe.ts';

/**
 * Add Booking Services — Inserts services into booking_services, then delegates
 * payment recalculation to payment-engine. No direct Stripe calls.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { booking_id, services } = await req.json();

    console.log('[ADD-BOOKING-SERVICES] Request:', { booking_id, services: services?.length });

    if (!booking_id || !services?.length) {
      throw new Error('booking_id and services are required');
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, payment_intent_id, payment_status, booking_services(*)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) throw new Error('Booking not found');

    if (booking.payment_status === 'captured') {
      throw new Error('Cannot add services to a booking that has already been charged. Please create a new booking for additional services.');
    }

    if (!booking.payment_intent_id) {
      throw new Error('Booking has no payment intent');
    }

    // Fetch real prices from services table (FIX PRICING LEAK)
    const serviceIds = services.map((s: any) => s.id);
    const { data: officialServices, error: svcErr } = await supabase
      .from('services')
      .select('id, base_price, name')
      .in('id', serviceIds);

    if (svcErr) throw new Error('Failed to fetch service prices');

    const priceMap = new Map(officialServices?.map(s => [s.id, Number(s.base_price)]) || []);

    // Build service data with official prices
    const servicesData = services.map((s: any) => {
      const officialPrice = priceMap.get(s.id);
      if (officialPrice === undefined) {
        console.warn(`[ADD-BOOKING-SERVICES] Service ${s.id} not found in services table`);
      }
      return {
        booking_id,
        service_id: s.id,
        service_name: s.name,
        base_price: officialPrice ?? s.price ?? 0,
        quantity: s.quantity || 1,
        configuration: s.configuration || {},
      };
    });

    // Insert services
    const { data: insertedServices, error: insertError } = await supabase
      .from('booking_services')
      .insert(servicesData)
      .select('id');

    if (insertError) {
      console.error('[ADD-BOOKING-SERVICES] Insert error:', insertError);
      throw new Error('Failed to add services to booking');
    }

    const insertedServiceIds = insertedServices?.map(s => s.id) || [];

    // Delegate payment recalculation to payment-engine
    console.log('[ADD-BOOKING-SERVICES] Delegating to payment-engine recalculate');
    const { data: engineResult, error: engineError } = await supabase.functions.invoke('payment-engine', {
      body: {
        action: 'recalculate',
        bookingId: booking_id,
        modification_reason: 'service_addition',
      },
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    });

    if (engineError || !engineResult?.success) {
      const errMsg = engineResult?.error || engineError?.message || 'Payment recalculation failed';
      console.error('[ADD-BOOKING-SERVICES] Recalculate failed, rolling back:', errMsg);

      // Rollback inserted services
      if (insertedServiceIds.length > 0) {
        await supabase.from('booking_services').delete().in('id', insertedServiceIds);
        console.log('[ADD-BOOKING-SERVICES] Rolled back', insertedServiceIds.length, 'services');
      }

      throw new Error(errMsg);
    }

    // Calculate new total for response
    const currentTotal = booking.booking_services?.reduce((sum: number, bs: any) =>
      sum + (Number(bs.base_price) * bs.quantity), 0) || 0;
    const newServicesTotal = servicesData.reduce((sum, s) => sum + (s.base_price * s.quantity), 0);
    const newTotal = currentTotal + newServicesTotal;

    // Update invoice in background
    EdgeRuntime.waitUntil(
      Promise.all([
        supabase.functions.invoke('update-invoice', {
          body: { booking_id, send_email: false }
        }).catch(e => console.error('[BG] Invoice update failed:', e)),
        supabase.functions.invoke('send-increment-notification', {
          body: { booking_id, original_amount: currentTotal, added_amount: newServicesTotal, new_total: newTotal }
        }).catch(e => console.error('[BG] Email notification failed:', e)),
      ])
    );

    return new Response(
      JSON.stringify({
        success: true,
        incremented: true,
        new_amount: newTotal,
        services_added: services.length,
        payment_intent_id: engineResult.new_payment_intent_id || booking.payment_intent_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ADD-BOOKING-SERVICES] Error:', error);
    
    let errorMessage = 'Failed to add services';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.message?.includes('Booking not found')) {
      errorMessage = 'Booking not found. Please refresh the page and try again.';
      errorCode = 'BOOKING_NOT_FOUND';
    } else if (error.message?.includes('no payment intent')) {
      errorMessage = 'No payment method on file. Please contact support.';
      errorCode = 'NO_PAYMENT_INTENT';
    } else if (error.message?.includes('already been charged')) {
      errorMessage = error.message;
      errorCode = 'ALREADY_CAPTURED';
    } else if (error.message?.includes('currently being modified')) {
      errorMessage = 'Booking is currently being modified. Please try again.';
      errorCode = 'LOCK_CONFLICT';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, error_code: errorCode }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
