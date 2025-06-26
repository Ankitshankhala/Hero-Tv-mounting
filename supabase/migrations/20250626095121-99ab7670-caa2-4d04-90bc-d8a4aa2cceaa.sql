
-- Fix remaining 4 RLS security errors - Non-breaking migration
-- Only enables RLS where it's missing and adds minimal required policies

-- Check and enable RLS on bookings table if not already enabled
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t 
        JOIN pg_class c ON c.relname = t.tablename 
        WHERE t.schemaname = 'public' 
        AND t.tablename = 'bookings' 
        AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Check and enable RLS on users table if not already enabled
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t 
        JOIN pg_class c ON c.relname = t.tablename 
        WHERE t.schemaname = 'public' 
        AND t.tablename = 'users' 
        AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Ensure bookings table has basic RLS policies (only add if missing)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Enable read access for booking participants') THEN
        CREATE POLICY "Enable read access for booking participants" ON public.bookings
        FOR SELECT USING (
            customer_id = auth.uid() OR 
            worker_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Enable insert for authenticated users') THEN
        CREATE POLICY "Enable insert for authenticated users" ON public.bookings
        FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Enable update for booking participants') THEN
        CREATE POLICY "Enable update for booking participants" ON public.bookings
        FOR UPDATE USING (
            customer_id = auth.uid() OR 
            worker_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Ensure users table has basic RLS policies (only add if missing)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Enable read access for own profile') THEN
        CREATE POLICY "Enable read access for own profile" ON public.users
        FOR SELECT USING (id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Enable admin read access') THEN
        CREATE POLICY "Enable admin read access" ON public.users
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Enable profile updates') THEN
        CREATE POLICY "Enable profile updates" ON public.users
        FOR UPDATE USING (
            id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Enable user registration') THEN
        CREATE POLICY "Enable user registration" ON public.users
        FOR INSERT WITH CHECK (id = auth.uid());
    END IF;
END $$;
