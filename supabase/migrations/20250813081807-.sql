-- Tighten RLS on transactions: remove public read access while preserving customer/worker/admin access
-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive public SELECT policy that allowed unauthenticated reads via payment_intent_id
DROP POLICY IF EXISTS "Enable transaction viewing for all users" ON public.transactions;

-- Existing policies retained:
-- 1) "Admins can manage all transactions" (ALL) -> admins retain full access
-- 2) "Users can view their related transactions" (SELECT) -> customers and assigned workers can view

-- Optional sanity: comment to document policy intent
COMMENT ON TABLE public.transactions IS 'Contains sensitive payment data. Access restricted to admin, booking customer, and assigned worker via RLS.';