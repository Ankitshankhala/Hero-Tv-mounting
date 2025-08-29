-- Add card-on-file columns to users table
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_default_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS has_saved_card BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_has_saved_card ON public.users (has_saved_card);

-- Backfill existing data from bookings table
UPDATE public.users u
SET stripe_customer_id = b.stripe_customer_id
FROM public.bookings b
WHERE b.customer_id = u.id
  AND b.stripe_customer_id IS NOT NULL
  AND u.stripe_customer_id IS NULL;

UPDATE public.users u
SET stripe_default_payment_method_id = b.stripe_payment_method_id,
    has_saved_card = CASE WHEN b.stripe_payment_method_id IS NOT NULL THEN true ELSE u.has_saved_card END
FROM public.bookings b
WHERE b.customer_id = u.id
  AND b.stripe_payment_method_id IS NOT NULL
  AND (u.stripe_default_payment_method_id IS NULL OR u.stripe_default_payment_method_id = '');