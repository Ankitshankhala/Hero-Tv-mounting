-- Add unique constraint to prevent duplicate transactions for same payment intent
ALTER TABLE public.transactions ADD CONSTRAINT unique_payment_intent_per_booking 
UNIQUE (booking_id, payment_intent_id);

-- Add constraint to prevent duplicate transactions of same type for same booking
ALTER TABLE public.transactions ADD CONSTRAINT unique_transaction_type_per_booking
UNIQUE (booking_id, transaction_type, payment_intent_id);

-- Create function to validate payment authorization before booking creation
CREATE OR REPLACE FUNCTION validate_payment_authorization()
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
$$ LANGUAGE plpgsql;

-- Add trigger to validate payment authorization
CREATE TRIGGER validate_booking_payment_authorization
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_authorization();