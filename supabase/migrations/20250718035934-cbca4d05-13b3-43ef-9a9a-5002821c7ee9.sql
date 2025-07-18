-- Add bulletproof enhancements for booking system

-- 1. Fix function search paths for security
DROP FUNCTION IF EXISTS public.validate_payment_authorization();
CREATE OR REPLACE FUNCTION public.validate_payment_authorization()
RETURNS TRIGGER AS $$
BEGIN
  -- If booking has payment_intent_id but status is not authorized, prevent creation
  IF NEW.payment_intent_id IS NOT NULL AND NEW.status != 'authorized' AND NEW.status != 'payment_pending' THEN
    RAISE EXCEPTION 'Booking with payment intent must have authorized or payment_pending status, got: %', NEW.status;
  END IF;
  
  -- If booking is authorized, it must have a payment_intent_id
  IF NEW.status = 'authorized' AND NEW.payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'Authorized booking must have a payment_intent_id';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 2. Add cascade deletion rules and cleanup mechanisms
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_payment_records()
RETURNS INTEGER AS $$
DECLARE
  cleanup_count INTEGER := 0;
BEGIN
  -- Delete transactions without corresponding bookings
  DELETE FROM public.transactions 
  WHERE booking_id NOT IN (SELECT id FROM public.bookings);
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', 'Cleanup orphaned records: ' || cleanup_count || ' transactions', 'sent', NULL);
  
  RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 3. Create audit trail table for comprehensive logging
CREATE TABLE IF NOT EXISTS public.booking_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  payment_intent_id TEXT,
  operation TEXT NOT NULL,
  status TEXT,
  details JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS on audit log
ALTER TABLE public.booking_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies for audit log
CREATE POLICY "Admins can view all audit logs" 
ON public.booking_audit_log 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE users.id = auth.uid() AND users.role = 'admin'
));

CREATE POLICY "System can insert audit logs" 
ON public.booking_audit_log 
FOR INSERT 
WITH CHECK (true);

-- 4. Add system health monitoring function
CREATE OR REPLACE FUNCTION public.check_system_health()
RETURNS TABLE(
  check_name TEXT,
  status TEXT,
  details TEXT,
  checked_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Check for orphaned transactions
  RETURN QUERY
  SELECT 
    'orphaned_transactions'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'healthy' ELSE 'warning' END::TEXT,
    'Found ' || COUNT(*) || ' transactions without bookings'::TEXT,
    now()::TIMESTAMPTZ
  FROM public.transactions t
  WHERE NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = t.booking_id);
  
  -- Check for bookings with payment_intent but no transactions
  RETURN QUERY
  SELECT 
    'missing_transactions'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'healthy' ELSE 'error' END::TEXT,
    'Found ' || COUNT(*) || ' paid bookings without transaction records'::TEXT,
    now()::TIMESTAMPTZ
  FROM public.bookings b
  WHERE b.payment_intent_id IS NOT NULL 
    AND b.status = 'authorized'
    AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.booking_id = b.id);
  
  -- Check for payment intent mismatches
  RETURN QUERY
  SELECT 
    'payment_intent_mismatch'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'healthy' ELSE 'error' END::TEXT,
    'Found ' || COUNT(*) || ' bookings with mismatched payment intents'::TEXT,
    now()::TIMESTAMPTZ
  FROM public.bookings b
  JOIN public.transactions t ON b.id = t.booking_id
  WHERE b.payment_intent_id != t.payment_intent_id;
  
  RETURN;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 5. Create function to log booking operations
CREATE OR REPLACE FUNCTION public.log_booking_operation(
  p_booking_id UUID,
  p_payment_intent_id TEXT,
  p_operation TEXT,
  p_status TEXT,
  p_details JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.booking_audit_log (
    booking_id,
    payment_intent_id,
    operation,
    status,
    details,
    error_message,
    created_by
  ) VALUES (
    p_booking_id,
    p_payment_intent_id,
    p_operation,
    p_status,
    p_details,
    p_error_message,
    auth.uid()
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql
SET search_path = public;