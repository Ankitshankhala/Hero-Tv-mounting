-- Make customer_id nullable in invoices table to support guest bookings
ALTER TABLE public.invoices ALTER COLUMN customer_id DROP NOT NULL;