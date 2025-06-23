
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { booking_id, urgent = false } = await req.json()

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get coverage notifications that were just created
    const { data: notifications, error: notificationError } = await supabase
      .from('worker_coverage_notifications')
      .select(`
        *,
        worker:users!worker_id(name, email, phone),
        booking:bookings!booking_id(
          *,
          customer:users!customer_id(name, city),
          service:services!service_id(name, base_price)
        )
      `)
      .eq('booking_id', booking_id)
      .is('response', null)
      .order('distance_priority')

    if (notificationError) {
      throw notificationError
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No notifications to send' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notificationPromises = notifications.map(async (notification) => {
      const { worker, booking } = notification
      
      // Create in-app notification
      const { error: inAppError } = await supabase
        .from('worker_notifications')
        .insert({
          worker_id: worker.id,
          title: urgent ? '🚨 Urgent Job Coverage Needed' : '📋 Job Coverage Available',
          body: `${booking.service?.name || 'Service'} needed in ${booking.customer?.city || 'your area'} on ${booking.scheduled_date} at ${booking.scheduled_start}. ${urgent ? 'Urgent coverage required!' : 'Can you help cover this job?'}`
        })

      if (inAppError) {
        console.error('Error creating in-app notification:', inAppError)
      }

      // Send SMS if worker has phone number
      if (worker.phone) {
        try {
          const smsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms-notification`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phone: worker.phone,
              message: `${urgent ? '🚨 URGENT' : '📋'} Job coverage needed: ${booking.service?.name || 'Service'} in ${booking.customer?.city || 'your area'} on ${booking.scheduled_date} at ${booking.scheduled_start}. Reply Y to accept, N to decline. Coverage ID: ${notification.id.slice(0, 8)}`
            })
          })

          if (!smsResponse.ok) {
            console.error('SMS sending failed:', await smsResponse.text())
          }
        } catch (smsError) {
          console.error('SMS error:', smsError)
        }
      }

      return {
        worker_id: worker.id,
        worker_name: worker.name,
        notification_sent: true
      }
    })

    const results = await Promise.all(notificationPromises)

    return new Response(
      JSON.stringify({
        message: `Coverage notifications sent to ${results.length} workers`,
        notifications_sent: results.length,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notify-workers-coverage:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
