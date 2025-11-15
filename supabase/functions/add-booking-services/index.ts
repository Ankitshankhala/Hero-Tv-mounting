import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const { booking_id, services, testing_mode = false } = await req.json();

    console.log('[ADD-BOOKING-SERVICES] Request:', { booking_id, services: services.length });

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, booking_services(*)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    if (!booking.payment_intent_id) {
      throw new Error('Booking has no payment intent');
    }

    // Calculate current total
    const currentTotal = booking.booking_services?.reduce((sum: number, bs: any) => 
      sum + (bs.base_price * bs.quantity), 0
    ) || 0;

    // Calculate new services total
    const newServicesTotal = services.reduce((sum: number, s: any) => 
      sum + (s.price * s.quantity), 0
    );

    const newTotal = currentTotal + newServicesTotal;
    const newTotalCents = Math.round(newTotal * 100);

    console.log('[ADD-BOOKING-SERVICES] Totals:', {
      current: currentTotal,
      new_services: newServicesTotal,
      new_total: newTotal
    });

    // Insert services into booking_services table
    const servicesData = services.map((s: any) => ({
      booking_id,
      service_id: s.id,
      service_name: s.name,
      base_price: s.price,
      quantity: s.quantity,
      configuration: s.configuration || {}
    }));

    const { data: insertedServices, error: insertError } = await supabase
      .from('booking_services')
      .insert(servicesData)
      .select('id');

    if (insertError) {
      console.error('[ADD-BOOKING-SERVICES] Insert error:', insertError);
      throw new Error('Failed to add services to booking');
    }

    // Store inserted IDs for potential rollback
    const insertedServiceIds = insertedServices?.map(s => s.id) || [];

    // Try incremental authorization
    let incremented = false;
    let incrementError = null;

    try {
      console.log('[ADD-BOOKING-SERVICES] Attempting increment authorization to:', newTotalCents);
      
      const updatedIntent = await stripe.paymentIntents.incrementAuthorization(
        booking.payment_intent_id,
        {
          amount: newTotalCents,
        }
      );

      if (updatedIntent.status === 'requires_capture') {
        incremented = true;
        
        // Update booking pending amount
        await supabase
          .from('bookings')
          .update({ 
            pending_payment_amount: newTotal,
            increment_attempted_at: new Date().toISOString()
          })
          .eq('id', booking_id);

        // Create increment transaction record
        await supabase
          .from('transactions')
          .insert({
            booking_id,
            amount: newTotal,
            status: 'authorized',
            payment_intent_id: booking.payment_intent_id,
            transaction_type: 'increment',
            payment_method: 'card'
          });

        console.log('[ADD-BOOKING-SERVICES] Increment successful');

        // Send notification email
        try {
          await supabase.functions.invoke('send-increment-notification', {
            body: { 
              booking_id,
              original_amount: currentTotal,
              added_amount: newServicesTotal,
              new_total: newTotal
            }
          });
        } catch (emailError) {
          console.error('[ADD-BOOKING-SERVICES] Email notification failed:', emailError);
          // Don't fail the whole operation if email fails
        }

      } else {
        throw new Error(`Unexpected payment intent status: ${updatedIntent.status}`);
      }

    } catch (error: any) {
      console.error('[ADD-BOOKING-SERVICES] Increment failed:', error.message);
      incrementError = error.message;
      
      // CRITICAL: Payment authorization failed - rollback inserted services
      if (!error.message?.includes('increment') && error.code !== 'payment_intent_increment_authorization_not_allowed') {
        console.log('[ADD-BOOKING-SERVICES] Rolling back inserted services due to payment failure');
        
        if (insertedServiceIds.length > 0) {
          await supabase
            .from('booking_services')
            .delete()
            .in('id', insertedServiceIds);
        }
        
        throw new Error(`Payment authorization failed: ${error.message}`);
      }
      
      // Check if card doesn't support increment
      if (error.message?.includes('increment') || error.code === 'payment_intent_increment_authorization_not_allowed') {
        console.log('[ADD-BOOKING-SERVICES] Card does not support increment - creating new payment intent');
        
        // Create new payment intent for full amount
        const newPaymentIntent = await stripe.paymentIntents.create({
          amount: newTotalCents,
          currency: 'usd',
          capture_method: 'manual',
          metadata: {
            booking_id,
            original_payment_intent: booking.payment_intent_id,
            reason: 'increment_not_supported'
          }
        });

        // Update booking with new payment intent (pending_payment_amount)
        await supabase
          .from('bookings')
          .update({ 
            pending_payment_amount: newTotal,
            increment_attempted_at: new Date().toISOString()
          })
          .eq('id', booking_id);

        return new Response(
          JSON.stringify({
            success: true,
            incremented: false,
            requires_new_payment: true,
            client_secret: newPaymentIntent.client_secret,
            new_amount: newTotal,
            old_payment_intent: booking.payment_intent_id,
            new_payment_intent: newPaymentIntent.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        incremented,
        new_amount: newTotal,
        services_added: services.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ADD-BOOKING-SERVICES] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to add services'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
