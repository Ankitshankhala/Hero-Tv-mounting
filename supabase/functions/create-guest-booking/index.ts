import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';
import { corsHeaders, refreshStripeMode } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Hydrate Stripe mode (test/live) from app_settings before any Stripe call.
  await refreshStripeMode();

  try {
    const supabaseClient = getSupabaseClient();

    const { bookingData } = await req.json();

    if (!bookingData) {
      throw new Error('Booking data is required');
    }

    console.log('Creating guest booking with data:', JSON.stringify(bookingData, null, 2));

    // Extract services array (if provided) before inserting booking
    const services = bookingData.services || [];
    delete bookingData.services; // Remove from booking data before insert

    // PHASE 1 FIX: Validate services array is not empty
    if (!services || services.length === 0) {
      console.error('❌ CRITICAL: Booking creation attempted without services array');
      throw new Error('Services array is required and cannot be empty. This prevents tip calculation corruption.');
    }
    console.log('✅ Services validation passed:', services.length, 'services provided');

    // Validate required fields
    if (!bookingData.service_id) {
      throw new Error('service_id is required');
    }
    if (!bookingData.scheduled_date) {
      throw new Error('scheduled_date is required');
    }
    if (!bookingData.scheduled_start) {
      throw new Error('scheduled_start is required');
    }
    if (!bookingData.guest_customer_info?.email) {
      throw new Error('guest_customer_info.email is required');
    }

    // PHASE 1: CRITICAL - Verify worker availability before creating booking
    console.log('🔍 Checking worker availability before creating booking...');

    const { data: availableWorkers, error: availError } = await supabaseClient.rpc(
      'find_available_workers_by_zip',
      {
        p_zipcode: bookingData.guest_customer_info.zipcode,
        p_date: bookingData.scheduled_date,
        p_time: bookingData.scheduled_start,
        p_duration_minutes: 60
      }
    );

    if (availError) {
      console.error('Worker availability check failed:', availError);
      throw new Error('Unable to verify worker availability. Please try again.');
    }

    if (!availableWorkers || availableWorkers.length === 0) {
      const errorMsg = `No workers available in ZIP ${bookingData.guest_customer_info.zipcode} ` +
        `on ${bookingData.scheduled_date} at ${bookingData.scheduled_start}. Please select a different date or time.`;
      console.warn('⚠️ ' + errorMsg);
      throw new Error(errorMsg);
    }

    console.log('✅ Workers available:', availableWorkers.length);

    // Verify preferred worker if specified
    if (bookingData.preferred_worker_id) {
      const preferredAvailable = availableWorkers.some(
        (w: any) => w.worker_id === bookingData.preferred_worker_id
      );
      
      if (!preferredAvailable) {
        console.warn('⚠️ Preferred worker not available, clearing preference');
        bookingData.preferred_worker_id = null;
      }
    }

    // PHASE 2: Reserve the best available worker
    const reservedWorker = availableWorkers[0];
    const reservationExpiry = new Date(Date.now() + 15 * 60 * 1000);
    console.log('🎯 Reserving worker:', reservedWorker.worker_id, 'until', reservationExpiry.toISOString());

    // Insert booking (using service role key to bypass RLS)
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .insert({
        customer_id: bookingData.customer_id || null,
        service_id: bookingData.service_id,
        scheduled_date: bookingData.scheduled_date,
        scheduled_start: bookingData.scheduled_start,
        location_notes: bookingData.location_notes || '',
        status: bookingData.status || 'payment_pending',
        payment_status: bookingData.payment_status || 'pending',
        requires_manual_payment: bookingData.requires_manual_payment || false,
        preferred_worker_id: bookingData.preferred_worker_id || null,
        reserved_worker_id: reservedWorker.worker_id, // NEW: Reserve worker
        reservation_expires_at: reservationExpiry.toISOString(), // NEW: 15-min expiry
        guest_customer_info: bookingData.guest_customer_info,
        tip_amount: bookingData.guest_customer_info?.tip_amount || 0,
        coupon_id: bookingData.coupon_id || null,
        coupon_code: bookingData.coupon_code || null,
        coupon_discount: bookingData.coupon_discount || 0,
        subtotal_before_discount: bookingData.subtotal_before_discount || null,
      })
      .select('id')
      .single();

    if (bookingError) {
      console.error('Booking insert error:', bookingError);
      throw new Error(`Failed to insert booking: ${bookingError.message}`);
    }

    console.log('✅ Booking created successfully:', booking.id);

    // Record coupon usage if a coupon was applied
    if (bookingData.coupon_id && bookingData.coupon_code) {
      console.log('📝 Recording coupon usage:', bookingData.coupon_code);
      
      const { error: couponError } = await supabaseClient
        .from('coupon_usage')
        .insert({
          coupon_id: bookingData.coupon_id,
          booking_id: booking.id,
          customer_email: bookingData.guest_customer_info.email.toLowerCase(),
          user_id: bookingData.customer_id || null,
          discount_amount: bookingData.coupon_discount || 0,
          order_total: bookingData.subtotal_before_discount || bookingData.total_price || 0,
        });

      if (couponError) {
        console.error('⚠️ Failed to record coupon usage:', couponError);
        // Don't fail the booking for coupon tracking error
      } else {
        console.log('✅ Coupon usage recorded successfully');
      }
    }

    // Insert booking services if provided
    if (services.length > 0) {
      // FIX PRICING LEAK: Fetch real prices from services table (with tiered pricing support)
      const serviceIds = services.map((s: any) => s.id);
      const { data: officialServices, error: officialError } = await supabaseClient
        .from('services')
        .select('id, base_price, pricing_config')
        .in('id', serviceIds);
      
      if (officialError) {
        console.warn('⚠️ Could not fetch official prices, using provided prices:', officialError);
      }

      // Build a map with full pricing info
      const priceMap = new Map<string, { base_price: number; pricing_config: any }>();
      for (const s of officialServices || []) {
        priceMap.set(s.id, {
          base_price: Number(s.base_price),
          pricing_config: s.pricing_config,
        });
      }

      const serviceInserts = services.map((service: any) => {
        const official = priceMap.get(service.id);
        let finalPrice = service.price ?? 0;

        if (official) {
          if (official.pricing_config?.pricing_type === 'tiered' && official.pricing_config?.tiers) {
            // Extract quantity from service name (e.g., "Mount TV (2 TVs)")
            const countMatch = service.name?.match(/\((\d+)\s+TVs?\)/i);
            const itemCount = countMatch ? parseInt(countMatch[1]) : (service.quantity || 1);

            // Calculate tiered total server-side
            let tieredTotal = 0;
            const tiers = official.pricing_config.tiers;
            for (let i = 1; i <= itemCount; i++) {
              const tier = tiers.find((t: any) => t.quantity === i);
              if (tier) {
                tieredTotal += tier.price;
              } else {
                // Use default tier for additional items, or last defined tier
                const defaultTier = tiers.find((t: any) => t.is_default_for_additional);
                tieredTotal += defaultTier?.price || tiers[tiers.length - 1]?.price || 0;
              }
            }
            finalPrice = tieredTotal;
            console.log(`📊 Tiered pricing for "${service.name}": ${itemCount} items = $${tieredTotal}`);
          } else {
            // Non-tiered: use base_price as source of truth
            finalPrice = official.base_price;
          }
        }

        return {
          booking_id: booking.id,
          service_id: service.id,
          service_name: service.name || 'Unknown Service',
          base_price: finalPrice,
          quantity: service.quantity || 1,
          configuration: service.options || {},
        };
      });

      const { error: servicesError } = await supabaseClient
        .from('booking_services')
        .insert(serviceInserts);

      if (servicesError) {
        console.error('❌ Booking services insert error:', servicesError);
        console.error('Failed service inserts:', JSON.stringify(serviceInserts, null, 2));
        throw new Error(`Failed to insert booking services: ${servicesError.message}`);
      } else {
        console.log('✅ Booking services inserted successfully:', serviceInserts.length, 'services');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: booking.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating guest booking:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to create guest booking',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
