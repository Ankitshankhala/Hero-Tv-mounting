
-- Final fix for remaining 2 RLS errors on public.users table
-- Uses direct approach to force enable RLS and verify policy coverage

-- Force enable RLS on users table using direct ALTER statement
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled by checking system catalog
DO $$ 
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    SELECT c.relrowsecurity INTO rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' 
    AND c.relname = 'users';
    
    IF NOT rls_enabled THEN
        RAISE EXCEPTION 'Failed to enable RLS on public.users table';
    END IF;
    
    RAISE NOTICE 'RLS successfully enabled on public.users table';
END $$;

-- Ensure comprehensive policy coverage for users table
-- Add DELETE policy if missing (to complete CRUD coverage)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Enable admin delete access') THEN
        CREATE POLICY "Enable admin delete access" ON public.users
        FOR DELETE USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Add ALL policy for admins if missing (comprehensive admin access)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Enable admin full access') THEN
        CREATE POLICY "Enable admin full access" ON public.users
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Force a schema refresh to ensure changes are recognized
SELECT pg_notify('ddl_command_end', 'users_rls_enabled');
