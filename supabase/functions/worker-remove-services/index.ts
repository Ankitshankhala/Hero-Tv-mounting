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
      throw new Error("Booking ID and service IDs are required");
    }

    // Verify worker has access to this booking using service role
    const { data: booking, error: bookingError } = await supabaseService
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking || booking.worker_id !== user.id) {
      throw new Error("Booking not found or access denied");
    }

    // Get services to be removed with their details
    const { data: servicesToRemove, error: servicesError } = await supabaseService
      .from('booking_services')
      .select('*')
      .eq('booking_id', booking_id)
      .in('id', service_ids);

    if (servicesError || !servicesToRemove?.length) {
      throw new Error("Services not found");
    }

    // Calculate total amount to refund
    const refundAmount = servicesToRemove.reduce((total, service) => {
      return total + (service.base_price * service.quantity);
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
      // Remove invoice items for deleted services
      await supabaseService
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoice.id)
        .in('service_name', servicesToRemove.map(s => s.service_name));

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
    } else {
      // No invoice exists yet, calculate totals from remaining services
      const { data: remainingServices } = await supabaseService
        .from('booking_services')
        .select('base_price, quantity')
        .eq('booking_id', booking_id);

      if (remainingServices && remainingServices.length > 0) {
        const subtotal = remainingServices.reduce((sum, service) => 
          sum + (service.base_price * service.quantity), 0);
        
        // Get tax rate (assuming 4.875% for now, should be from booking location)
        const taxRate = 0.04875;
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;

        console.log(`[WORKER-REMOVE] No invoice found, calculated remaining total: $${total}`);
      } else {
        console.log(`[WORKER-REMOVE] No services remaining after removal`);
      }
    }

    // Mark booking as having modifications and create modification records
    await supabaseService
      .from('bookings')
      .update({ has_modifications: true })
      .eq('id', booking_id);

    // Create service modification records
    const modificationRecords = servicesToRemove.map(service => ({
      booking_id: booking_id,
      worker_id: user.id,
      service_name: service.service_name,
      modification_type: 'removed',
      price_change: -(service.base_price * service.quantity),
      description: 'Removed by worker'
    }));

    await supabaseService
      .from('booking_service_modifications')
      .insert(modificationRecords);

    console.log(`[WORKER-REMOVE] Created ${modificationRecords.length} modification records`);

    // Handle Stripe refund if payment exists
    let refundResult = null;
    if (booking.payment_intent_id && refundAmount > 0) {
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
        });

        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        
        if (paymentIntent.status === 'succeeded') {
          // Payment already captured - create partial refund
          const refundAmountCents = Math.round(refundAmount * 100);
          
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

          await supabaseService.from('transactions').insert({
            booking_id: booking_id,
            payment_intent_id: booking.payment_intent_id,
            amount: -refundAmount, // Negative for refund
            transaction_type: 'refund',
            status: 'completed',
            stripe_refund_id: refundResult.id,
            cancellation_reason: 'Services removed by worker'
          });
        } else if (paymentIntent.status === 'requires_capture') {
          // Payment not captured yet - let capture function handle reduced amount
          console.log(`[WORKER-REMOVE] Payment pending capture, reduced amount will be captured later`);
        }
      } catch (stripeError) {
        console.error(`[WORKER-REMOVE] Stripe refund failed:`, stripeError);
        // Continue even if refund fails - log the issue
      }
    }

    // Log the removal
    await supabaseService.from('sms_logs').insert({
      booking_id: booking_id,
      recipient_number: 'system',
      message: `Services removed by worker: ${servicesToRemove.map(s => s.service_name).join(', ')}`,
      status: 'sent'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Services removed successfully",
        removed_services: servicesToRemove.length,
        refund_amount: refundAmount,
        refund_id: refundResult?.id || null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? (error.message || "Failed to remove services") : "Failed to remove services";
    console.error("[WORKER-REMOVE] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});