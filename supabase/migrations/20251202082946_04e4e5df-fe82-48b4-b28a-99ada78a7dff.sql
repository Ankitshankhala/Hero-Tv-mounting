-- Phase 2: Add customer_sms_sent tracking
-- Add customer_sms_sent flag to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS customer_sms_sent boolean DEFAULT false;

-- Backfill: Set true for bookings that already have customer SMS logs
UPDATE public.bookings b
SET customer_sms_sent = true
WHERE EXISTS (
  SELECT 1 FROM public.sms_logs s
  WHERE s.booking_id = b.id
  AND s.sms_type = 'customer_confirmation'
  AND s.status = 'sent'
  AND s.twilio_sid IS NOT NULL
);

-- Create index for customer SMS status queries
CREATE INDEX IF NOT EXISTS idx_bookings_customer_sms_sent 
ON public.bookings(customer_sms_sent) 
WHERE customer_sms_sent = false;

-- Create resend_customer_sms function for manual resends
CREATE OR REPLACE FUNCTION public.resend_customer_sms(booking_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Log the manual resend attempt
  INSERT INTO public.sms_logs (
    booking_id,
    recipient_number,
    message,
    status,
    sms_type,
    recipient_name
  )
  SELECT 
    b.id,
    COALESCE(
      b.guest_customer_info->>'phone',
      u.phone,
      'unknown'
    ),
    'Manual customer SMS resend requested',
    'pending',
    'manual_resend',
    COALESCE(
      b.guest_customer_info->>'name',
      u.name,
      'Customer'
    )
  FROM public.bookings b
  LEFT JOIN public.users u ON b.customer_id = u.id
  WHERE b.id = booking_id_param;

  -- Return success - the actual SMS will be sent via edge function
  result := jsonb_build_object(
    'success', true,
    'message', 'Customer SMS resend initiated',
    'booking_id', booking_id_param
  );
  
  RETURN result;
END;
$$;