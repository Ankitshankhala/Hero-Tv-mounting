
-- Modified RLS Fix - Only add missing policies and enable RLS where needed
-- This addresses the 19 RLS security errors without conflicting with existing policies

-- Enable RLS on tables that don't have it (checking current state)
ALTER TABLE public.booking_service_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onsite_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_coverage_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_schedule ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for booking_service_modifications (new table)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_service_modifications' AND policyname = 'Workers can view their own modifications') THEN
        CREATE POLICY "Workers can view their own modifications" ON public.booking_service_modifications
        FOR SELECT USING (worker_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_service_modifications' AND policyname = 'Workers can create their own modifications') THEN
        CREATE POLICY "Workers can create their own modifications" ON public.booking_service_modifications
        FOR INSERT WITH CHECK (worker_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_service_modifications' AND policyname = 'Admins can view all modifications') THEN
        CREATE POLICY "Admins can view all modifications" ON public.booking_service_modifications
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for invoice_items (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_items' AND policyname = 'Users can view invoice items for their bookings') THEN
        CREATE POLICY "Users can view invoice items for their bookings" ON public.invoice_items
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.invoices i 
                JOIN public.bookings b ON i.booking_id = b.id
                WHERE i.id = invoice_items.invoice_id 
                AND (b.customer_id = auth.uid() OR b.worker_id = auth.uid())
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_items' AND policyname = 'Admins can manage all invoice items') THEN
        CREATE POLICY "Admins can manage all invoice items" ON public.invoice_items
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for invoices (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Customers can view their own invoices') THEN
        CREATE POLICY "Customers can view their own invoices" ON public.invoices
        FOR SELECT USING (customer_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Workers can view invoices for their bookings') THEN
        CREATE POLICY "Workers can view invoices for their bookings" ON public.invoices
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.bookings b 
                WHERE b.id = invoices.booking_id AND b.worker_id = auth.uid()
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Admins can manage all invoices') THEN
        CREATE POLICY "Admins can manage all invoices" ON public.invoices
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for manual_charges (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_charges' AND policyname = 'Users can view charges for their bookings') THEN
        CREATE POLICY "Users can view charges for their bookings" ON public.manual_charges
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.bookings b 
                WHERE b.id = manual_charges.booking_id 
                AND (b.customer_id = auth.uid() OR b.worker_id = auth.uid())
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_charges' AND policyname = 'Workers can create charges for their bookings') THEN
        CREATE POLICY "Workers can create charges for their bookings" ON public.manual_charges
        FOR INSERT WITH CHECK (
            charged_by = auth.uid() AND
            EXISTS (
                SELECT 1 FROM public.bookings b 
                WHERE b.id = manual_charges.booking_id AND b.worker_id = auth.uid()
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_charges' AND policyname = 'Admins can manage all manual charges') THEN
        CREATE POLICY "Admins can manage all manual charges" ON public.manual_charges
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for onsite_charges (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onsite_charges' AND policyname = 'Users can view onsite charges for their bookings') THEN
        CREATE POLICY "Users can view onsite charges for their bookings" ON public.onsite_charges
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.bookings b 
                WHERE b.id = onsite_charges.booking_id 
                AND (b.customer_id = auth.uid() OR b.worker_id = auth.uid())
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onsite_charges' AND policyname = 'Workers can create onsite charges for their bookings') THEN
        CREATE POLICY "Workers can create onsite charges for their bookings" ON public.onsite_charges
        FOR INSERT WITH CHECK (
            added_by = auth.uid() AND
            EXISTS (
                SELECT 1 FROM public.bookings b 
                WHERE b.id = onsite_charges.booking_id AND b.worker_id = auth.uid()
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onsite_charges' AND policyname = 'Admins can manage all onsite charges') THEN
        CREATE POLICY "Admins can manage all onsite charges" ON public.onsite_charges
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for payment_sessions (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_sessions' AND policyname = 'Users can view their own payment sessions') THEN
        CREATE POLICY "Users can view their own payment sessions" ON public.payment_sessions
        FOR SELECT USING (user_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_sessions' AND policyname = 'Users can create their own payment sessions') THEN
        CREATE POLICY "Users can create their own payment sessions" ON public.payment_sessions
        FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_sessions' AND policyname = 'Admins can view all payment sessions') THEN
        CREATE POLICY "Admins can view all payment sessions" ON public.payment_sessions
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for reviews (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can view reviews') THEN
        CREATE POLICY "Anyone can view reviews" ON public.reviews
        FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Customers can create reviews for their bookings') THEN
        CREATE POLICY "Customers can create reviews for their bookings" ON public.reviews
        FOR INSERT WITH CHECK (
            customer_id = auth.uid() AND
            EXISTS (
                SELECT 1 FROM public.bookings b 
                WHERE b.id = reviews.booking_id AND b.customer_id = auth.uid()
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Customers can update their own reviews') THEN
        CREATE POLICY "Customers can update their own reviews" ON public.reviews
        FOR UPDATE USING (customer_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Admins can manage all reviews') THEN
        CREATE POLICY "Admins can manage all reviews" ON public.reviews
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for services (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'Anyone can view active services') THEN
        CREATE POLICY "Anyone can view active services" ON public.services
        FOR SELECT USING (is_active = true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'Admins can manage all services') THEN
        CREATE POLICY "Admins can manage all services" ON public.services
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for sms_logs (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Admins can view all SMS logs') THEN
        CREATE POLICY "Admins can view all SMS logs" ON public.sms_logs
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Admins can manage SMS logs') THEN
        CREATE POLICY "Admins can manage SMS logs" ON public.sms_logs
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for transactions (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Users can view transactions for their bookings') THEN
        CREATE POLICY "Users can view transactions for their bookings" ON public.transactions
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.bookings b 
                WHERE b.id = transactions.booking_id 
                AND (b.customer_id = auth.uid() OR b.worker_id = auth.uid())
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Admins can manage all transactions') THEN
        CREATE POLICY "Admins can manage all transactions" ON public.transactions
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for worker_applications (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_applications' AND policyname = 'Anyone can create worker applications') THEN
        CREATE POLICY "Anyone can create worker applications" ON public.worker_applications
        FOR INSERT WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_applications' AND policyname = 'Admins can manage all worker applications') THEN
        CREATE POLICY "Admins can manage all worker applications" ON public.worker_applications
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for worker_availability (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_availability' AND policyname = 'Workers can manage their own availability') THEN
        CREATE POLICY "Workers can manage their own availability" ON public.worker_availability
        FOR ALL USING (worker_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_availability' AND policyname = 'Admins can view all worker availability') THEN
        CREATE POLICY "Admins can view all worker availability" ON public.worker_availability
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for worker_bookings (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_bookings' AND policyname = 'Workers can view their own bookings') THEN
        CREATE POLICY "Workers can view their own bookings" ON public.worker_bookings
        FOR SELECT USING (worker_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_bookings' AND policyname = 'Customers can view worker bookings for their bookings') THEN
        CREATE POLICY "Customers can view worker bookings for their bookings" ON public.worker_bookings
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.bookings b 
                WHERE b.id = worker_bookings.booking_id AND b.customer_id = auth.uid()
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_bookings' AND policyname = 'Admins can manage all worker bookings') THEN
        CREATE POLICY "Admins can manage all worker bookings" ON public.worker_bookings
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for worker_coverage_notifications (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_coverage_notifications' AND policyname = 'Workers can view their own coverage notifications') THEN
        CREATE POLICY "Workers can view their own coverage notifications" ON public.worker_coverage_notifications
        FOR SELECT USING (worker_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_coverage_notifications' AND policyname = 'Workers can update their own coverage notifications') THEN
        CREATE POLICY "Workers can update their own coverage notifications" ON public.worker_coverage_notifications
        FOR UPDATE USING (worker_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_coverage_notifications' AND policyname = 'Admins can manage all coverage notifications') THEN
        CREATE POLICY "Admins can manage all coverage notifications" ON public.worker_coverage_notifications
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for worker_notifications (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_notifications' AND policyname = 'Workers can view their own notifications') THEN
        CREATE POLICY "Workers can view their own notifications" ON public.worker_notifications
        FOR SELECT USING (worker_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_notifications' AND policyname = 'Workers can update their own notifications') THEN
        CREATE POLICY "Workers can update their own notifications" ON public.worker_notifications
        FOR UPDATE USING (worker_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_notifications' AND policyname = 'Admins can manage all worker notifications') THEN
        CREATE POLICY "Admins can manage all worker notifications" ON public.worker_notifications
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- Create RLS policies for worker_schedule (missing policies)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_schedule' AND policyname = 'Workers can manage their own schedule') THEN
        CREATE POLICY "Workers can manage their own schedule" ON public.worker_schedule
        FOR ALL USING (worker_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_schedule' AND policyname = 'Admins can view all worker schedules') THEN
        CREATE POLICY "Admins can view all worker schedules" ON public.worker_schedule
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;
