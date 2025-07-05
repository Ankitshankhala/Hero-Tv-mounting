-- Add missing columns to sms_logs table for better tracking
ALTER TABLE public.sms_logs 
ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id),
ADD COLUMN IF NOT EXISTS twilio_sid text,
ADD COLUMN IF NOT EXISTS error_message text;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_booking_id ON sms_logs(booking_id);