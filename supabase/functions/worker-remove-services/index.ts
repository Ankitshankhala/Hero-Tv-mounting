import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Create service role client for privileged operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { booking_id, service_ids } = await req.json();

    if (!booking_id || !Array.isArray(service_ids) || service_ids.length === 0) {
      console.error("[WORKER-REMOVE] Invalid request: missing booking_id or service_ids");
      throw new Error("Booking ID and service IDs are required");
    }

    console.log(`[WORKER-REMOVE] Processing removal request for booking ${booking_id}, services: ${service_ids.join(', ')}`);

    // Idempotency check: verify services still exist
    const { data: existingServices, error: checkError } = await supabaseService
      .from('booking_services')
      .select('id')
      .eq('booking_id', booking_id)
      .in('id', service_ids);

    if (checkError) {
      console.error("[WORKER-REMOVE] Error checking existing services:", checkError);
      throw new Error("Failed to verify services");
    }

    // If no services found, they were already deleted - return success (idempotent)
    if (!existingServices || existingServices.length === 0) {
      console.log("[WORKER-REMOVE] Services already removed, returning success (idempotent)");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Services already removed",
          data: {
            removed_services: 0,
            service_names: [],
            refund_amount: 0,
            refund_id: null,
            invoice_updated: false
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify worker has access to this booking using service role
    const { data: booking, error: bookingError } = await supabaseService
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error("[WORKER-REMOVE] Booking not found:", bookingError);
      throw new Error("Booking not found");
    }

    if (booking.worker_id !== user.id) {
      console.error("[WORKER-REMOVE] Access denied: worker_id mismatch");
      throw new Error("Access denied");
    }

    // Phase 4: Prevent removing from completed bookings
    if (booking.status === 'completed') {
      console.error("[WORKER-REMOVE] Cannot remove services from completed booking");
      throw new Error("Cannot remove services from completed bookings");
    }

    // Get services to be removed with their details
    const { data: servicesToRemove, error: servicesError } = await supabaseService
      .from('booking_services')
      .select('*')
      .eq('booking_id', booking_id)
      .in('id', service_ids);

    if (servicesError) {
      console.error("[WORKER-REMOVE] Error fetching services:", servicesError);
      throw new Error("Failed to fetch services to remove");
    }

    if (!servicesToRemove?.length) {
      console.error("[WORKER-REMOVE] No services found to remove");
      throw new Error("Services not found");
    }

    // Phase 4: Check if we're removing all services
    const { count: totalServicesCount } = await supabaseService
      .from('booking_services')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', booking_id);

    if (totalServicesCount === servicesToRemove.length) {
      console.error("[WORKER-REMOVE] Cannot remove all services from booking");
      throw new Error("Cannot remove all services. At least one service must remain.");
    }

    // Calculate total amount to refund including add-ons (TV mounting configuration)
    const calculateServicePrice = (service: any) => {
      let price = Number(service.base_price) || 0;
      const config = service.configuration || {};

      // Mount TV specific pricing with add-ons
      if (service.service_name === 'Mount TV') {
        if (config.over65) price += 50;
        if (config.frameMount) price += 75;
        if (config.wallType === 'steel' || config.wallType === 'brick' || config.wallType === 'concrete') {
          price += 40;
        }
        if (config.soundbar) price += 30;
      }

      return price;
    };

    const refundAmount = servicesToRemove.reduce((total, service) => {
      const servicePrice = calculateServicePrice(service);
      return total + (servicePrice * service.quantity);
    }, 0);

    console.log(`[WORKER-REMOVE] Removing services worth $${refundAmount} from booking ${booking_id}`);

    // Remove booking services using service role
    const { error: removeError } = await supabaseService
      .from('booking_services')
      .delete()
      .in('id', service_ids);

    if (removeError) {
      throw new Error(`Failed to remove services: ${removeError.message}`);
    }

    // Update invoice if it exists
    const { data: invoice } = await supabaseService
      .from('invoices')
      .select('*')
      .eq('booking_id', booking_id)
      .maybeSingle();

    if (invoice) {
      // Remove invoice items for deleted services - delete by exact match
      for (const service of servicesToRemove) {
        const servicePrice = calculateServicePrice(service);
        const totalPrice = servicePrice * service.quantity;
        
        await supabaseService
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invoice.id)
          .eq('service_name', service.service_name)
          .eq('unit_price', servicePrice)
          .eq('quantity', service.quantity)
          .eq('total_price', totalPrice);
      }

      // Recalculate invoice totals
      const { data: remainingItems } = await supabaseService
        .from('invoice_items')
        .select('total_price')
        .eq('invoice_id', invoice.id);

      const newAmount = remainingItems?.reduce((sum, item) => sum + Number(item.total_price), 0) || 0;
      const newTaxAmount = newAmount * (invoice.tax_rate || 0);
      const newTotal = newAmount + newTaxAmount;

      await supabaseService
        .from('invoices')
        .update({
          amount: newAmount,
          tax_amount: newTaxAmount,
          total_amount: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      console.log(`[WORKER-REMOVE] Updated invoice ${invoice.id}: $${invoice.amount} -> $${newAmount}`);

      // CRITICAL FIX: Also call update-invoice to ensure full sync (preserves invoice number)
      try {
        console.log('[WORKER-REMOVE] Syncing invoice via update-invoice...');
        await supabaseService.functions.invoke('update-invoice', {
          body: {
            booking_id,
            send_email: false
          }
        });
        console.log('[WORKER-REMOVE] Invoice synced successfully');
      } catch (syncError) {
        console.error('[WORKER-REMOVE] Invoice sync failed:', syncError);
        // Don't fail - manual update already done
      }
    } else {
      // No invoice exists yet - create one via update-invoice (will create if not exists)
      console.log('[WORKER-REMOVE] No invoice found, creating one...');
      try {
        await supabaseService.functions.invoke('update-invoice', {
          body: {
            booking_id,
            send_email: false
          }
        });
        console.log('[WORKER-REMOVE] Invoice created successfully');
      } catch (createError) {
        console.error('[WORKER-REMOVE] Invoice creation failed:', createError);
      }
    }

    // Mark booking as having modifications and create modification records
    await supabaseService
      .from('bookings')
      .update({ has_modifications: true })
      .eq('id', booking_id);

    // Phase 1: Create service modification records in correct table
    const modificationRecords = servicesToRemove.map(service => ({
      booking_id: booking_id,
      worker_id: user.id,
      service_name: service.service_name,
      modification_type: 'removed',
      price_change: -(service.base_price * service.quantity),
      old_configuration: service.configuration || {},
      new_configuration: {}
    }));

    const { error: modError } = await supabaseService
      .from('invoice_service_modifications')
      .insert(modificationRecords);

    if (modError) {
      console.error("[WORKER-REMOVE] Failed to create modification records:", modError);
      throw new Error("Failed to log service modifications");
    }

    console.log(`[WORKER-REMOVE] Created ${modificationRecords.length} modification records`);

    // Handle Stripe refund if payment exists
    let refundResult = null;
    if (booking.payment_intent_id && refundAmount > 0) {
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
        });

        console.log(`[WORKER-REMOVE] Retrieving payment intent ${booking.payment_intent_id}`);
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        
        if (paymentIntent.status === 'succeeded') {
          // Check total refunded amount to allow multiple partial refunds
          const { data: existingRefunds } = await supabaseService
            .from('transactions')
            .select('amount')
            .eq('booking_id', booking_id)
            .eq('transaction_type', 'refund');

          const totalRefunded = existingRefunds?.reduce((sum, r) => sum + Math.abs(r.amount), 0) || 0;
          const originalAmount = paymentIntent.amount / 100; // Convert from cents

          if (totalRefunded + refundAmount > originalAmount) {
            console.error("[WORKER-REMOVE] Refund would exceed original payment", {
              totalRefunded,
              requestedRefund: refundAmount,
              originalAmount
            });
            throw new Error(`Cannot refund $${refundAmount.toFixed(2)}. Total refunds would exceed original payment of $${originalAmount.toFixed(2)}`);
          }

          // Payment already captured - create partial refund
          const refundAmountCents = Math.round(refundAmount * 100);
          
          console.log(`[WORKER-REMOVE] Creating refund of $${refundAmount} (${refundAmountCents} cents)`);
          refundResult = await stripe.refunds.create({
            payment_intent: booking.payment_intent_id,
            amount: refundAmountCents,
            reason: 'requested_by_customer',
            metadata: {
              booking_id: booking_id,
              worker_id: user.id,
              removed_services: servicesToRemove.map(s => s.service_name).join(', ')
            }
          });

          console.log(`[WORKER-REMOVE] Partial refund created: ${refundResult.id} for $${refundAmount}`);

          const { error: txError } = await supabaseService.from('transactions').insert({
            booking_id: booking_id,
            payment_intent_id: booking.payment_intent_id,
            amount: -refundAmount, // Negative for refund
            transaction_type: 'refund',
            status: 'completed',
            stripe_refund_id: refundResult.id,
            cancellation_reason: 'Services removed by worker'
          });

          if (txError) {
            console.error("[WORKER-REMOVE] Failed to create transaction record:", txError);
          }
        } else if (paymentIntent.status === 'requires_capture') {
          // CRITICAL FIX: Payment not captured yet - update pending_payment_amount
          console.log(`[WORKER-REMOVE] Payment pending capture, updating pending_payment_amount`);
          
          // Recalculate new total from remaining services
          const { data: remainingServicesForCapture } = await supabaseService
            .from('booking_services')
            .select('base_price, quantity, configuration, service_name')
            .eq('booking_id', booking_id);

          const newServicesTotal = remainingServicesForCapture?.reduce((sum, s) => {
            return sum + calculateServicePrice(s) * s.quantity;
          }, 0) || 0;
          
          const tipAmount = booking.tip_amount || 0;
          const newPendingAmount = newServicesTotal + tipAmount;

          // Update booking with new pending amount
          const { error: updateError } = await supabaseService
            .from('bookings')
            .update({ 
              pending_payment_amount: newPendingAmount,
              has_modifications: true
            })
            .eq('id', booking_id);

          if (updateError) {
            console.error("[WORKER-REMOVE] Failed to update pending_payment_amount:", updateError);
          } else {
            console.log(`[WORKER-REMOVE] Updated pending_payment_amount: $${newPendingAmount} (services: $${newServicesTotal}, tip: $${tipAmount})`);
          }
        } else {
          console.log(`[WORKER-REMOVE] Payment status: ${paymentIntent.status}, no refund needed`);
        }
      } catch (stripeError) {
        console.error(`[WORKER-REMOVE] Stripe refund failed:`, stripeError);
        // Phase 2: Better error message
        throw new Error(`Failed to process refund: ${stripeError.message || "Unknown error"}`);
      }
    }

    // Log the removal
    await supabaseService.from('sms_logs').insert({
      booking_id: booking_id,
      recipient_number: 'system',
      message: `Services removed by worker: ${servicesToRemove.map(s => s.service_name).join(', ')}`,
      status: 'sent'
    });

    // Phase 2: Enhanced success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Services removed successfully",
        data: {
          removed_services: servicesToRemove.length,
          service_names: servicesToRemove.map(s => s.service_name),
          refund_amount: refundAmount,
          refund_id: refundResult?.id || null,
          invoice_updated: !!invoice
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    // Phase 2: Enhanced error handling and logging
    const errorMessage = error instanceof Error ? error.message : "Failed to remove services";
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    console.error("[WORKER-REMOVE] Error:", {
      message: errorMessage,
      details: errorDetails,
      user_id: user?.id,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});