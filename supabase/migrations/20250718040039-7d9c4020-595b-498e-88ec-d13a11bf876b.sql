-- Fix the validation function with proper search path
DROP TRIGGER IF EXISTS validate_booking_payment_authorization ON public.bookings;
DROP FUNCTION IF EXISTS public.validate_payment_authorization() CASCADE;

-- Recreate the function with proper search path
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

-- Recreate the trigger
CREATE TRIGGER validate_booking_payment_authorization
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_authorization();

-- Add cleanup and monitoring functions
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

-- Create audit trail table
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