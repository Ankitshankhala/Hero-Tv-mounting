import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { booking_id, rating, title, comment, image_url } = body ?? {};

    if (!booking_id || typeof booking_id !== 'string') {
      return json({ success: false, error: 'booking_id is required' }, 400);
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return json({ success: false, error: 'rating must be an integer 1-5' }, 400);
    }
    if (!comment || typeof comment !== 'string' || comment.trim().length < 3) {
      return json({ success: false, error: 'comment is required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, status, customer_id, worker_id, guest_customer_info, service_city, service_state, location_notes')
      .eq('id', booking_id)
      .maybeSingle();

    if (bErr || !booking) {
      return json({ success: false, error: 'Booking not found' }, 404);
    }
    if (booking.status !== 'completed') {
      return json({ success: false, error: 'You can only review completed bookings.' }, 400);
    }

    // Prevent duplicates
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', booking_id)
      .maybeSingle();
    if (existing) {
      return json({ success: false, error: 'A review has already been submitted for this booking.' }, 409);
    }

    // Resolve customer name
    let customerName = 'Customer';
    let city: string | null = booking.service_city ?? null;
    if (booking.customer_id) {
      const { data: u } = await supabase.from('users').select('name, city').eq('id', booking.customer_id).maybeSingle();
      if (u?.name) customerName = u.name;
      if (!city && u?.city) city = u.city;
    } else if (booking.guest_customer_info) {
      const g = booking.guest_customer_info as any;
      if (g?.name) customerName = g.name;
    }

    const { error: iErr } = await supabase.from('reviews').insert({
      booking_id,
      customer_id: booking.customer_id,
      worker_id: booking.worker_id,
      customer_name: customerName,
      city,
      rating: ratingNum,
      title: title?.toString().trim() || null,
      comment: comment.trim(),
      image_url: image_url?.toString() || null,
      status: 'pending',
    });

    if (iErr) {
      return json({ success: false, error: iErr.message }, 500);
    }

    return json({
      success: true,
      message: 'Thanks! Your review has been submitted and will appear after approval.',
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
