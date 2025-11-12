-- Performance Optimization Part 1: Database Indexes

-- Bookings table indexes
CREATE INDEX IF NOT EXISTS idx_bookings_created_at 
  ON bookings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_status 
  ON bookings(status);

CREATE INDEX IF NOT EXISTS idx_bookings_payment_status 
  ON bookings(payment_status);

CREATE INDEX IF NOT EXISTS idx_bookings_archived 
  ON bookings(is_archived, created_at DESC) WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_bookings_worker_id 
  ON bookings(worker_id) WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_service_id 
  ON bookings(service_id);

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_booking_id 
  ON transactions(booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status 
  ON transactions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_type_status 
  ON transactions(transaction_type, status, created_at DESC);

-- Booking services table indexes
CREATE INDEX IF NOT EXISTS idx_booking_services_booking_id 
  ON booking_services(booking_id);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_role_active 
  ON users(role, is_active);