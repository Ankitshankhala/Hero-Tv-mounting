-- Add external_id column to email_logs table for email provider tracking
ALTER TABLE public.email_logs 
ADD COLUMN external_id TEXT;

-- Add index for performance on external_id lookups
CREATE INDEX idx_email_logs_external_id ON public.email_logs (external_id);

-- Add comment to explain the purpose
COMMENT ON COLUMN public.email_logs.external_id IS 'External email provider ID (e.g., Resend email ID) for tracking delivery status';