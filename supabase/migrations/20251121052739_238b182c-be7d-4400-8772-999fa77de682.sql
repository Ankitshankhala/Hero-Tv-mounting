-- Create function to validate booking has services before critical operations
CREATE OR REPLACE FUNCTION check_booking_has_services()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for non-pending and non-cancelled bookings
  IF NEW.status NOT IN ('pending', 'cancelled') THEN
    -- Check if booking has associated services
    IF NOT EXISTS (
      SELECT 1 FROM booking_services 
      WHERE booking_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot update booking to status % without associated services. Booking ID: %', 
        NEW.status, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce booking services requirement
DROP TRIGGER IF EXISTS enforce_booking_services_on_status_change ON bookings;
CREATE TRIGGER enforce_booking_services_on_status_change
  BEFORE UPDATE OF status ON bookings
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION check_booking_has_services();

-- Create function to log data integrity issues
CREATE OR REPLACE FUNCTION log_booking_integrity_issue()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when a booking is created without a service_id
  IF NEW.service_id IS NULL THEN
    INSERT INTO admin_alerts (
      alert_type,
      severity,
      booking_id,
      message,
      details
    ) VALUES (
      'booking_missing_service_id',
      'high',
      NEW.id,
      'Booking created without service_id',
      jsonb_build_object(
        'customer_id', NEW.customer_id,
        'created_at', NEW.created_at,
        'status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to monitor booking creation
DROP TRIGGER IF EXISTS monitor_booking_creation ON bookings;
CREATE TRIGGER monitor_booking_creation
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION log_booking_integrity_issue();

-- Create index for faster booking_services lookups
CREATE INDEX IF NOT EXISTS idx_booking_services_booking_id 
  ON booking_services(booking_id);

-- Create view for bookings with integrity issues
CREATE OR REPLACE VIEW v_bookings_integrity_issues AS
SELECT 
  b.id as booking_id,
  b.status,
  b.payment_status,
  b.payment_intent_id,
  b.service_id,
  b.created_at,
  b.updated_at,
  COUNT(bs.id) as service_count,
  CASE 
    WHEN COUNT(bs.id) = 0 AND b.status NOT IN ('pending', 'cancelled') THEN 'missing_services'
    WHEN b.service_id IS NULL THEN 'missing_service_id'
    WHEN b.payment_intent_id IS NULL AND b.status NOT IN ('pending', 'cancelled') THEN 'missing_payment_intent'
    ELSE 'ok'
  END as issue_type
FROM bookings b
LEFT JOIN booking_services bs ON bs.booking_id = b.id
WHERE b.created_at > NOW() - INTERVAL '90 days'
GROUP BY b.id
HAVING COUNT(bs.id) = 0 OR b.service_id IS NULL 
  OR (b.payment_intent_id IS NULL AND b.status NOT IN ('pending', 'cancelled'));

COMMENT ON VIEW v_bookings_integrity_issues IS 'Identifies bookings with data integrity issues for monitoring';
