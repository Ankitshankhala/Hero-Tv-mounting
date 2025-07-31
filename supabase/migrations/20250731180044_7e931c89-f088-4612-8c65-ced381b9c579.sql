-- CRITICAL: Create missing triggers for payment authorization workflow

-- 1. Trigger for updating booking status when transaction status changes
CREATE TRIGGER trigger_update_booking_on_payment_auth
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_on_payment_auth();

-- 2. Trigger for auto-assignment when booking becomes authorized
CREATE TRIGGER trigger_auto_assign_authorized_booking
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_assign_on_authorized_booking();

-- 3. Trigger for worker assignment notification emails
CREATE TRIGGER trigger_worker_assignment_email
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION send_worker_assignment_notification();

-- 4. Trigger for customer booking confirmation emails
CREATE TRIGGER trigger_customer_confirmation_email
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION send_customer_booking_confirmation();

-- 5. Trigger for booking payment consistency validation
CREATE TRIGGER trigger_validate_booking_payment_consistency
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_payment_consistency();

-- 6. Trigger for payment authorization validation
CREATE TRIGGER trigger_validate_payment_authorization
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_authorization();

-- 7. Trigger for cancellation deadline calculation
CREATE TRIGGER trigger_set_cancellation_deadline
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_cancellation_deadline();

-- 8. Trigger for updating updated_at timestamps
CREATE TRIGGER trigger_update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_booking_services_updated_at
  BEFORE UPDATE ON booking_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_state_tax_rates_updated_at
  BEFORE UPDATE ON state_tax_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_worker_applications_updated_at
  BEFORE UPDATE ON worker_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_applications_updated_at();

-- 9. Trigger for transaction cancellation handling
CREATE TRIGGER trigger_update_transaction_cancelled_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_cancelled_at();

-- 10. Trigger for admin notification on assignment failure
CREATE TRIGGER trigger_notify_admin_assignment_failure
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_of_assignment_failure();

-- 11. Trigger for worker assignment confirmation
CREATE TRIGGER trigger_notify_worker_assignment
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_worker_assignment();

-- 12. Trigger for auto-invoicing
CREATE TRIGGER trigger_auto_invoice_on_booking_change
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_invoice();

-- 13. Trigger for idempotency record cleanup (optional, for maintenance)
-- This can be run periodically via a scheduled function if needed