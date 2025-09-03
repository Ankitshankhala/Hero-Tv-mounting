import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BatchInvoiceRequest {
  force_regenerate?: boolean;
  send_email?: boolean;
  payment_status_filter?: 'captured' | 'completed' | 'all';
  max_bookings?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      force_regenerate = false, 
      send_email = true, 
      payment_status_filter = 'captured',
      max_bookings = 100 
    }: BatchInvoiceRequest = await req.json();
    
    console.log('Starting batch invoice generation for completed jobs...', {
      force_regenerate,
      send_email,
      payment_status_filter,
      max_bookings
    });

    // Build query for completed bookings
    let query = supabase
      .from('bookings')
      .select(`
        id,
        status,
        payment_status,
        payment_intent_id,
        customer_id,
        guest_customer_info,
        scheduled_date,
        created_at
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(max_bookings);

    // Apply payment status filter
    if (payment_status_filter !== 'all') {
      query = query.eq('payment_status', payment_status_filter);
    }

    const { data: completedBookings, error: bookingsError } = await query;

    if (bookingsError) {
      throw new Error(`Failed to fetch completed bookings: ${bookingsError.message}`);
    }

    console.log(`Found ${completedBookings?.length || 0} completed bookings with payment status: ${payment_status_filter}`);

    if (!completedBookings?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: `No completed bookings with payment status '${payment_status_filter}' found`,
        generated_count: 0,
        skipped_count: 0,
        failed_count: 0
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check which bookings already have invoices (unless force regenerate)
    let bookingsToProcess = completedBookings;
    
    if (!force_regenerate) {
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('booking_id')
        .in('booking_id', completedBookings.map(b => b.id));

      const existingBookingIds = new Set(existingInvoices?.map(inv => inv.booking_id) || []);
      bookingsToProcess = completedBookings.filter(booking => !existingBookingIds.has(booking.id));
      
      console.log(`${existingBookingIds.size} bookings already have invoices, processing ${bookingsToProcess.length} remaining`);
    }

    if (bookingsToProcess.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'All completed bookings already have invoices',
        generated_count: 0,
        skipped_count: completedBookings.length,
        failed_count: 0
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Process invoices in batches to avoid overwhelming the system
    const BATCH_SIZE = 5;
    const results = {
      generated_count: 0,
      failed_count: 0,
      skipped_count: completedBookings.length - bookingsToProcess.length,
      errors: [] as string[]
    };

    for (let i = 0; i < bookingsToProcess.length; i += BATCH_SIZE) {
      const batch = bookingsToProcess.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} bookings`);

      // Process batch concurrently but with limited parallelism
      const batchPromises = batch.map(async (booking) => {
        try {
          console.log(`Generating invoice for booking ${booking.id}`);
          
          const invoiceResponse = await supabase.functions.invoke('enhanced-invoice-generator', {
            body: {
              booking_id: booking.id,
              send_email: send_email,
              trigger_source: 'batch_generation'
            }
          });

          if (invoiceResponse.error) {
            console.error(`Failed to generate invoice for booking ${booking.id}:`, invoiceResponse.error);
            return { success: false, booking_id: booking.id, error: invoiceResponse.error.message };
          } else {
            console.log(`Successfully generated invoice for booking ${booking.id}`);
            return { success: true, booking_id: booking.id, result: invoiceResponse.data };
          }
        } catch (error) {
          console.error(`Error processing booking ${booking.id}:`, error);
          return { success: false, booking_id: booking.id, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          results.generated_count++;
        } else {
          results.failed_count++;
          results.errors.push(`Booking ${result.booking_id}: ${result.error}`);
        }
      });

      // Small delay between batches to be respectful to the system
      if (i + BATCH_SIZE < bookingsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Log the batch operation
    await supabase
      .from('sms_logs')
      .insert({
        booking_id: null,
        recipient_number: 'system',
        message: `Batch invoice generation completed: ${results.generated_count} generated, ${results.failed_count} failed, ${results.skipped_count} skipped`,
        status: results.failed_count > 0 ? 'failed' : 'sent',
        error_message: results.errors.length > 0 ? results.errors.join('; ') : null
      });

    console.log('Batch invoice generation completed:', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Batch invoice generation completed`,
      ...results,
      total_processed: bookingsToProcess.length,
      details: {
        total_completed_bookings: completedBookings.length,
        processed_bookings: bookingsToProcess.length,
        success_rate: bookingsToProcess.length > 0 ? ((results.generated_count / bookingsToProcess.length) * 100).toFixed(1) + '%' : '0%'
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in batch-invoice-generator:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        generated_count: 0,
        failed_count: 0,
        skipped_count: 0
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);