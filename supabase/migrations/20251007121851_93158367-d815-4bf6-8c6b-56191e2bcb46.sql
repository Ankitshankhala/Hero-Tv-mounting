
-- Step 1: Backfill missing transactions for September and October 2024 bookings
-- This will create transaction records for all bookings with payment_intent_id but no transactions

INSERT INTO public.transactions (
  booking_id,
  amount,
  status,
  currency,
  transaction_type,
  payment_intent_id,
  payment_method,
  guest_customer_email,
  created_at
)
SELECT 
  b.id as booking_id,
  -- Get amount from booking_services or fallback to service base_price
  COALESCE(
    (SELECT SUM(bs.base_price * bs.quantity) 
     FROM booking_services bs 
     WHERE bs.booking_id = b.id),
    (SELECT s.base_price 
     FROM services s 
     WHERE s.id = b.service_id)
  ) as amount,
  -- Map booking payment_status to transaction status
  CASE 
    WHEN b.payment_status = 'completed' THEN 'completed'::payment_status
    WHEN b.payment_status = 'authorized' THEN 'authorized'::payment_status
    WHEN b.payment_status = 'captured' THEN 'completed'::payment_status
    WHEN b.payment_status = 'pending' THEN 'pending'::payment_status
    ELSE 'pending'::payment_status
  END as status,
  'USD' as currency,
  CASE 
    WHEN b.payment_status IN ('completed', 'captured') THEN 'capture'
    WHEN b.payment_status = 'authorized' THEN 'authorization'
    ELSE 'charge'
  END as transaction_type,
  b.payment_intent_id,
  'card' as payment_method,
  COALESCE(
    (b.guest_customer_info->>'email'),
    (SELECT u.email FROM users u WHERE u.id = b.customer_id)
  ) as guest_customer_email,
  b.created_at
FROM public.bookings b
WHERE b.payment_intent_id IS NOT NULL
  AND b.created_at >= '2024-09-01'
  AND b.created_at < '2024-11-01'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.booking_id = b.id
  );

-- Step 2: Create trigger function to automatically create transactions for new bookings
CREATE OR REPLACE FUNCTION public.auto_create_transaction_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create transaction if booking has payment_intent_id
  IF NEW.payment_intent_id IS NOT NULL THEN
    
    -- Check if transaction already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions 
      WHERE booking_id = NEW.id
    ) THEN
      
      -- Insert transaction record
      INSERT INTO public.transactions (
        booking_id,
        amount,
        status,
        currency,
        transaction_type,
        payment_intent_id,
        payment_method,
        guest_customer_email,
        created_at
      )
      VALUES (
        NEW.id,
        -- Get amount from booking_services or service base_price
        COALESCE(
          (SELECT SUM(bs.base_price * bs.quantity) 
           FROM booking_services bs 
           WHERE bs.booking_id = NEW.id),
          (SELECT s.base_price 
           FROM services s 
           WHERE s.id = NEW.service_id)
        ),
        -- Map payment_status to transaction status
        CASE 
          WHEN NEW.payment_status = 'completed' THEN 'completed'::payment_status
          WHEN NEW.payment_status = 'authorized' THEN 'authorized'::payment_status
          WHEN NEW.payment_status = 'captured' THEN 'completed'::payment_status
          ELSE 'pending'::payment_status
        END,
        'USD',
        CASE 
          WHEN NEW.payment_status IN ('completed', 'captured') THEN 'capture'
          WHEN NEW.payment_status = 'authorized' THEN 'authorization'
          ELSE 'charge'
        END,
        NEW.payment_intent_id,
        'card',
        COALESCE(
          (NEW.guest_customer_info->>'email'),
          (SELECT u.email FROM users u WHERE u.id = NEW.customer_id)
        ),
        NEW.created_at
      );
      
      -- Log transaction creation
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status)
      VALUES (NEW.id, 'system', 'Transaction auto-created for booking', 'sent');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new bookings
DROP TRIGGER IF EXISTS trg_auto_create_transaction_on_insert ON public.bookings;
CREATE TRIGGER trg_auto_create_transaction_on_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_transaction_on_booking();

-- Create trigger for booking updates (when payment_intent_id is added later)
DROP TRIGGER IF EXISTS trg_auto_create_transaction_on_update ON public.bookings;
CREATE TRIGGER trg_auto_create_transaction_on_update
  AFTER UPDATE OF payment_intent_id ON public.bookings
  FOR EACH ROW
  WHEN (NEW.payment_intent_id IS NOT NULL AND OLD.payment_intent_id IS NULL)
  EXECUTE FUNCTION public.auto_create_transaction_on_booking();

-- Step 3: Create monitoring view to detect missing transactions
CREATE OR REPLACE VIEW public.v_missing_transactions AS
SELECT 
  b.id as booking_id,
  b.created_at,
  b.payment_intent_id,
  b.payment_status,
  b.status as booking_status,
  COALESCE(
    (b.guest_customer_info->>'email'),
    (SELECT u.email FROM users u WHERE u.id = b.customer_id)
  ) as customer_email,
  'Missing transaction record' as issue
FROM public.bookings b
WHERE b.payment_intent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.booking_id = b.id
  )
ORDER BY b.created_at DESC;

-- Grant access to monitoring view
GRANT SELECT ON public.v_missing_transactions TO authenticated;
GRANT SELECT ON public.v_missing_transactions TO service_role;

COMMENT ON VIEW public.v_missing_transactions IS 'Monitors bookings with payment_intent_id but no corresponding transaction records';
