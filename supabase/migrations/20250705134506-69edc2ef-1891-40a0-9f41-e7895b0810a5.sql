-- Enable the pg_net extension for HTTP calls from database functions
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Ensure the trigger is created on the bookings table
DROP TRIGGER IF EXISTS trigger_notify_worker_assignment ON bookings;
CREATE TRIGGER trigger_notify_worker_assignment
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_worker_assignment();