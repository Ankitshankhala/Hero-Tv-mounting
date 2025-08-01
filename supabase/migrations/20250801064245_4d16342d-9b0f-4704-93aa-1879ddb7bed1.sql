-- Make customer_id nullable in invoices table to support guest bookings
ALTER TABLE public.invoices ALTER COLUMN customer_id DROP NOT NULL;

-- Add a check constraint to ensure either customer_id is not null OR guest customer info exists in the related booking
-- This ensures data integrity while allowing guest bookings to have invoices
ALTER TABLE public.invoices ADD CONSTRAINT customer_id_or_guest_check 
CHECK (
  customer_id IS NOT NULL OR 
  EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE bookings.id = invoices.booking_id 
    AND bookings.guest_customer_info IS NOT NULL
  )
);