
-- Drop existing problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;

-- Create a security definer function to get current user role safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  -- Use a direct query to auth.uid() without referencing the users table
  -- This prevents infinite recursion in RLS policies
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- For the admin user specifically, return 'admin' directly
  IF auth.uid() = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid THEN
    RETURN 'admin';
  END IF;
  
  -- For other users, we'll need to query but we'll do it safely
  RETURN (
    SELECT role FROM public.users 
    WHERE id = auth.uid() 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create new non-recursive policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any user" ON users
  FOR UPDATE USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (public.get_current_user_role() = 'admin');
