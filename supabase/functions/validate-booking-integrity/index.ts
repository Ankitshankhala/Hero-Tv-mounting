import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  bookingId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bookingId, autoFix = false } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'bookingId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating booking integrity: ${bookingId}, autoFix: ${autoFix}`);

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      bookingId
    };

    // Fetch booking with services
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        booking_services (*)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      result.isValid = false;
      result.errors.push('Booking not found');
      return new Response(
        JSON.stringify(result),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if booking has services
    if (!booking.booking_services || booking.booking_services.length === 0) {
      result.isValid = false;
      result.errors.push('Booking has no associated services');

      // Auto-fix: Create booking_services from service_id if available
      if (autoFix && booking.service_id) {
        console.log(`Auto-fixing: Creating booking_services for booking ${bookingId}`);
        
        const { data: service, error: serviceError } = await supabase
          .from('services')
          .select('*')
          .eq('id', booking.service_id)
          .single();

        if (!serviceError && service) {
          const { error: insertError } = await supabase
            .from('booking_services')
            .insert({
              booking_id: bookingId,
              service_id: service.id,
              service_name: service.name,
              base_price: service.base_price || 0,
              quantity: 1,
              configuration: {}
            });

          if (!insertError) {
            result.warnings.push('Auto-fixed: Created booking_services from service_id');
            
            // Log the fix
            await supabase.from('booking_audit_log').insert({
              booking_id: bookingId,
              operation: 'auto_fix_services',
              status: 'success',
              details: {
                action: 'created_missing_booking_services',
                service_id: service.id,
                service_name: service.name
              }
            });
          } else {
            result.errors.push(`Auto-fix failed: ${insertError.message}`);
          }
        }
      }

      // Create admin alert
      await supabase.from('admin_alerts').insert({
        alert_type: 'booking_validation_failure',
        severity: 'high',
        booking_id: bookingId,
        message: 'Booking has no associated services',
        details: {
          autoFixAttempted: autoFix,
          bookingStatus: booking.status,
          serviceId: booking.service_id
        }
      });
    } else {
      // Validate each service
      for (const service of booking.booking_services) {
        if (!service.service_name || service.service_name.trim() === '') {
          result.warnings.push(`Service ${service.id} has no name`);
        }
        if (service.base_price === null || service.base_price === undefined) {
          result.errors.push(`Service ${service.service_name || 'Unknown'} has no base price`);
          result.isValid = false;
        }
        if (service.quantity === null || service.quantity === undefined || service.quantity < 1) {
          result.errors.push(`Service ${service.service_name || 'Unknown'} has invalid quantity`);
          result.isValid = false;
        }
      }
    }

    // Check payment_intent_id consistency
    if (booking.status !== 'pending' && booking.status !== 'cancelled' && !booking.payment_intent_id) {
      result.warnings.push('Booking has no payment_intent_id but is not in pending/cancelled status');
    }

    console.log('Validation result:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating booking integrity:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
