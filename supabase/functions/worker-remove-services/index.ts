import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Worker Remove Services — Removes services from a booking, then delegates
 * payment operations to payment-engine. No direct Stripe calls.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let user: any = null;

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    user = data.user;

    if (!user) throw new Error("User not authenticated");

    const { booking_id, service_ids } = await req.json();

    if (!booking_id || !Array.isArray(service_ids) || service_ids.length === 0) {
      throw new Error("Booking ID and service IDs are required");
    }

    console.log(`[WORKER-REMOVE] Processing removal for booking ${booking_id}, services: ${service_ids.join(', ')}`);

    // Idempotency check
    const { data: existingServices, error: checkError } = await supabaseService
      .from('booking_services')
      .select('id')
      .eq('booking_id', booking_id)
      .in('id', service_ids);

    if (checkError) throw new Error("Failed to verify services");

    if (!existingServices || existingServices.length === 0) {
      console.log("[WORKER-REMOVE] Services already removed (idempotent)");
      return new Response(
        JSON.stringify({
          success: true, message: "Services already removed",
          data: { removed_services: 0, service_names: [], refund_amount: 0, refund_id: null, invoice_updated: false }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify worker access
    const { data: booking, error: bookingError } = await supabaseService
      .from('bookings')
      .select('id, payment_intent_id, payment_status, worker_id, status, tip_amount, has_modifications, stripe_customer_id, stripe_payment_method_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) throw new Error("Booking not found");
    if (booking.worker_id !== user.id) throw new Error("Access denied");
    if (booking.status === 'completed') throw new Error("Cannot remove services from completed bookings");

    // Get services to be removed (snapshot before deletion)
    const { data: servicesToRemove, error: servicesError } = await supabaseService
      .from('booking_services')
      .select('id, service_id, service_name, base_price, quantity, configuration')
      .eq('booking_id', booking_id)
      .in('id', service_ids);

    if (servicesError) throw new Error("Failed to fetch services to remove");
    if (!servicesToRemove?.length) throw new Error("Services not found");

    // Check if removing all services
    const { count: totalServicesCount } = await supabaseService
      .from('booking_services')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', booking_id);

    if (totalServicesCount === servicesToRemove.length) {
      throw new Error("Cannot remove all services. At least one service must remain.");
    }

    // Calculate refund amount from official prices
    const refundAmount = servicesToRemove.reduce((total, service) => {
      return total + (Number(service.base_price) * service.quantity);
    }, 0);

    console.log(`[WORKER-REMOVE] Removing services worth $${refundAmount} from booking ${booking_id}`);

    // Delete services
    const { error: removeError } = await supabaseService
      .from('booking_services')
      .delete()
      .in('id', service_ids);

    if (removeError) throw new Error(`Failed to remove services: ${removeError.message}`);

    // Update invoice
    const { data: invoice } = await supabaseService
      .from('invoices')
      .select('id, tax_rate')
      .eq('booking_id', booking_id)
      .maybeSingle();

    if (invoice) {
      for (const service of servicesToRemove) {
        await supabaseService.from('invoice_items').delete()
          .eq('invoice_id', invoice.id)
          .eq('service_name', service.service_name)
          .eq('quantity', service.quantity);
      }

      const { data: remainingItems } = await supabaseService
        .from('invoice_items')
        .select('total_price')
        .eq('invoice_id', invoice.id);

      const newAmount = remainingItems?.reduce((sum, item) => sum + Number(item.total_price), 0) || 0;
      const newTaxAmount = newAmount * (invoice.tax_rate || 0);
      await supabaseService.from('invoices').update({
        amount: newAmount, tax_amount: newTaxAmount, total_amount: newAmount + newTaxAmount,
        updated_at: new Date().toISOString()
      }).eq('id', invoice.id);

      try {
        await supabaseService.functions.invoke('update-invoice', {
          body: { booking_id, send_email: false }
        });
      } catch (e) {
        console.error('[WORKER-REMOVE] Invoice sync failed:', e);
      }
    }

    // Mark booking as modified + create modification records
    await supabaseService.from('bookings').update({ has_modifications: true }).eq('id', booking_id);

    const modificationRecords = servicesToRemove.map(service => ({
      booking_id,
      worker_id: user.id,
      service_name: service.service_name,
      modification_type: 'removed',
      price_change: -(Number(service.base_price) * service.quantity),
      old_configuration: service.configuration || {},
      new_configuration: {}
    }));

    await supabaseService.from('invoice_service_modifications').insert(modificationRecords);

    // Delegate payment operations to payment-engine
    let paymentResult = null;
    if (booking.payment_intent_id && refundAmount > 0) {
      try {
        if (booking.payment_status === 'authorized') {
          // Pre-capture: recalculate
          console.log('[WORKER-REMOVE] Delegating to payment-engine recalculate');
          const { data: engineResult, error: engineError } = await supabaseService.functions.invoke('payment-engine', {
            body: {
              action: 'recalculate',
              bookingId: booking_id,
              modification_reason: 'service_removal',
            },
            headers: { Authorization: authHeader },
          });

          if (engineError) {
            console.error('[WORKER-REMOVE] Recalculate failed:', engineError);
          } else {
            paymentResult = engineResult;
            console.log('[WORKER-REMOVE] Recalculate result:', engineResult?.action);
          }
        } else if (booking.payment_status === 'captured') {
          // Post-capture: refund difference
          console.log('[WORKER-REMOVE] Delegating to payment-engine refund-difference');
          const { data: engineResult, error: engineError } = await supabaseService.functions.invoke('payment-engine', {
            body: {
              action: 'refund-difference',
              bookingId: booking_id,
              removed_services: servicesToRemove.map(s => ({
                service_id: s.service_id,
                service_name: s.service_name,
                base_price: Number(s.base_price),
                quantity: s.quantity,
              })),
            },
            headers: { Authorization: authHeader },
          });

          if (engineError) {
            console.error('[WORKER-REMOVE] Refund failed:', engineError);
          } else {
            paymentResult = engineResult;
            console.log('[WORKER-REMOVE] Refund result:', engineResult?.action);
          }
        }
      } catch (paymentError: any) {
        console.error('[WORKER-REMOVE] Payment operation failed:', paymentError.message);
      }
    }

    // Log removal
    await supabaseService.from('sms_logs').insert({
      booking_id,
      recipient_number: 'system',
      message: `Services removed by worker: ${servicesToRemove.map(s => s.service_name).join(', ')}`,
      status: 'sent'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Services removed successfully",
        data: {
          removed_services: servicesToRemove.length,
          service_names: servicesToRemove.map(s => s.service_name),
          refund_amount: paymentResult?.refund_amount || 0,
          refund_id: paymentResult?.refund_id || null,
          invoice_updated: !!invoice,
          authorization_updated: paymentResult?.action === 'reauthorized',
          new_payment_intent_id: paymentResult?.new_payment_intent_id || null,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to remove services";
    console.error("[WORKER-REMOVE] Error:", { message: errorMessage, user_id: user?.id });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
