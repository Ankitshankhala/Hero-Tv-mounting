-- Create idempotency records table for production-grade duplicate prevention
CREATE TABLE public.idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('booking_create', 'payment_intent', 'payment_confirm')),
  request_hash TEXT NOT NULL,
  response_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index for idempotency key + operation type
CREATE UNIQUE INDEX idx_idempotency_key_operation ON public.idempotency_records(idempotency_key, operation_type);

-- Create index for cleanup queries
CREATE INDEX idx_idempotency_expires ON public.idempotency_records(expires_at);
CREATE INDEX idx_idempotency_user_created ON public.idempotency_records(user_id, created_at);

-- Enable Row Level Security
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

-- Users can only see their own idempotency records
CREATE POLICY "Users can view own idempotency records" ON public.idempotency_records
  FOR SELECT USING (user_id = auth.uid());

-- Service role can manage all records (for edge functions)
CREATE POLICY "Service role can manage idempotency records" ON public.idempotency_records
  FOR ALL USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_idempotency_records_updated_at
  BEFORE UPDATE ON public.idempotency_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add cleanup function for expired records
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_records()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleanup_count INTEGER := 0;
BEGIN
  -- Delete records older than their expiry time
  DELETE FROM public.idempotency_records 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', 'Idempotency cleanup: ' || cleanup_count || ' records', 'sent', NULL);
  
  RETURN cleanup_count;
END;
$$;