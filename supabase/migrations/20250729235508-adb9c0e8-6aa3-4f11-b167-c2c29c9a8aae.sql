-- Add recipient_name column to sms_logs table to store the actual recipient's name
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS recipient_name text;

-- Add an index for better performance when filtering by recipient name
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient_name ON public.sms_logs(recipient_name);