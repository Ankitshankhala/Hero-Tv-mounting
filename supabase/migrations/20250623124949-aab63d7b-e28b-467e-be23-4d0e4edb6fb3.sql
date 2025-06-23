
-- First, add new values to the booking_status enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'authorized';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'captured';

-- Add payment_intent_id column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed', 'expired'));

-- Add index for payment_intent_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent_id ON public.bookings(payment_intent_id);

-- Update transactions table to track authorization vs capture
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'charge' CHECK (transaction_type IN ('authorization', 'capture', 'charge', 'refund'));
