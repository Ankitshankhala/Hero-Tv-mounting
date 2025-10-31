-- Phase 2: Add worker reservation system to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS reserved_worker_id UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster reservation lookups
CREATE INDEX IF NOT EXISTS idx_bookings_reserved_worker 
ON public.bookings(reserved_worker_id, reservation_expires_at) 
WHERE reserved_worker_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.bookings.reserved_worker_id IS 
'Worker temporarily reserved for this booking before payment confirmation (15-minute hold)';
COMMENT ON COLUMN public.bookings.reservation_expires_at IS 
'Expiration time for worker reservation - booking cancelled if payment not completed';

-- Create function to auto-release expired reservations
CREATE OR REPLACE FUNCTION public.release_expired_worker_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  released_count INTEGER;
BEGIN
  -- Release expired reservations and cancel associated bookings
  UPDATE public.bookings
  SET 
    reserved_worker_id = NULL,
    reservation_expires_at = NULL,
    status = CASE 
      WHEN status = 'payment_pending' AND payment_status = 'pending' THEN 'cancelled'
      ELSE status
    END
  WHERE reserved_worker_id IS NOT NULL
    AND reservation_expires_at < NOW()
    AND status IN ('payment_pending', 'worker_reserved');
  
  GET DIAGNOSTICS released_count = ROW_COUNT;
  
  IF released_count > 0 THEN
    RAISE NOTICE 'Released % expired worker reservations', released_count;
  END IF;
  
  RETURN released_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.release_expired_worker_reservations() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_worker_reservations() TO authenticated;

-- Phase 4: Create admin alerts table for tracking critical issues
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  details JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries on unresolved alerts
CREATE INDEX IF NOT EXISTS idx_admin_alerts_unresolved 
ON public.admin_alerts(created_at DESC) 
WHERE resolved = FALSE;

-- Add index for booking lookups
CREATE INDEX IF NOT EXISTS idx_admin_alerts_booking 
ON public.admin_alerts(booking_id) 
WHERE booking_id IS NOT NULL;

-- Add comments
COMMENT ON TABLE public.admin_alerts IS 
'Tracks critical system alerts that require admin attention, especially failed worker assignments';
COMMENT ON COLUMN public.admin_alerts.severity IS 
'Alert severity: low, medium, high, or critical (critical = payment authorized but no worker assigned)';

-- Enable RLS on admin_alerts (admins only)
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view alerts
CREATE POLICY "Admins can view all alerts"
ON public.admin_alerts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy: System can insert alerts (service role)
CREATE POLICY "System can create alerts"
ON public.admin_alerts
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Admins can update alerts
CREATE POLICY "Admins can update alerts"
ON public.admin_alerts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);