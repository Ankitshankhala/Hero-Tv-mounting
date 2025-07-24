-- Drop the conflicting trigger and function that's causing the u.full_name error
DROP TRIGGER IF EXISTS auto_assign_worker_on_booking_trigger ON bookings;
DROP FUNCTION IF EXISTS auto_assign_worker_on_booking();