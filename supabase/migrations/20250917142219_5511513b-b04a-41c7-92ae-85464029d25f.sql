-- Enable real-time updates for critical tables used in admin metrics
-- This ensures revenue and other metrics sync in real-time

-- Add transactions table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Add bookings table to realtime publication (if not already added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- Add users table to realtime publication (if not already added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- Set replica identity to FULL to ensure complete row data is captured during updates
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;