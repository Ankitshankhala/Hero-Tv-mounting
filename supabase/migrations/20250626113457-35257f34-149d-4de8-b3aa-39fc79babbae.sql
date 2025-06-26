
-- Fix infinite recursion in users table RLS policies
-- Drop existing problematic policies that cause recursion
DROP POLICY IF EXISTS "Enable admin read access" ON public.users;
DROP POLICY IF EXISTS "Enable admin full access" ON public.users;
DROP POLICY IF EXISTS "Enable admin delete access" ON public.users;

-- Create non-recursive policies for users table
-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON public.users
FOR SELECT USING (id = auth.uid());

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE USING (id = auth.uid());

-- Allow user registration (insert their own record)
CREATE POLICY "Users can insert own profile" ON public.users
FOR INSERT WITH CHECK (id = auth.uid());

-- Simple admin policy that doesn't cause recursion
-- This allows direct admin access without checking the users table recursively
CREATE POLICY "Direct admin access" ON public.users
FOR ALL USING (
    auth.jwt() ->> 'email' = 'admin@tvmountpro.com'
);
