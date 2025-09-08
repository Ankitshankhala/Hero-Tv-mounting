-- Add preferred_worker_id column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN preferred_worker_id UUID REFERENCES auth.users(id);