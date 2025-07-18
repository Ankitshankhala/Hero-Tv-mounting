import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

    console.log('Sending coverage notifications for booking:', bookingId);

    // Initialize Supabase client with service role
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get workers who need coverage notifications for this booking
    const { data: notifications, error: notificationsError } = await supabaseServiceRole
      .from('worker_coverage_notifications')
      .select(`
        id,
        worker_id,
        booking_id,
        distance_priority,
        notification_type,
        response,
        bookings (
          id,
          scheduled_date,
          scheduled_start,
          services (name)
        ),
        users (
          name,
          phone,
          email
        )
      `)
      .eq('booking_id', bookingId)
      .is('response', null);

    if (notificationsError) {
      console.error('Failed to get notifications:', notificationsError);
      throw notificationsError;
    }

    if (!notifications || notifications.length === 0) {
      console.log('No pending notifications found for booking');
      return new Response(JSON.stringify({
        success: true,
        message: 'No notifications to send',
        notifications_sent: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let notificationsSent = 0;

    // Send notifications to workers
    for (const notification of notifications) {
      try {
        const worker = notification.users;
        const booking = notification.bookings;

        if (!worker || !booking) {
          console.error('Missing worker or booking data for notification:', notification.id);
          continue;
        }

        // Create in-app notification
        const { error: inAppError } = await supabaseServiceRole
          .from('worker_notifications')
          .insert({
            worker_id: notification.worker_id,
            title: 'New Coverage Request',
            body: `Coverage needed for ${booking.services?.name || 'service'} on ${booking.scheduled_date} at ${booking.scheduled_start}`,
            is_read: false,
          });

        if (inAppError) {
          console.error('Failed to create in-app notification:', inAppError);
        }

        // Send SMS if phone number available
        if (worker.phone) {
          try {
            const { error: smsError } = await supabaseServiceRole.functions.invoke('send-sms-notification', {
              body: {
                to: worker.phone,
                message: `Coverage request: ${booking.services?.name || 'Service'} on ${booking.scheduled_date} at ${booking.scheduled_start}. Reply Y to accept or N to decline.`,
                bookingId: booking.id,
              }
            });

            if (smsError) {
              console.error('Failed to send SMS:', smsError);
            }
          } catch (smsError) {
            console.error('SMS sending failed:', smsError);
          }
        }

        // Update notification as sent
        const { error: updateError } = await supabaseServiceRole
          .from('worker_coverage_notifications')
          .update({
            sent_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        if (updateError) {
          console.error('Failed to update notification status:', updateError);
        } else {
          notificationsSent++;
        }

      } catch (error) {
        console.error('Error processing notification:', error);
      }
    }

    console.log(`Successfully sent ${notificationsSent} notifications`);

    return new Response(JSON.stringify({
      success: true,
      notifications_sent: notificationsSent,
      booking_id: bookingId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error sending coverage notifications:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});