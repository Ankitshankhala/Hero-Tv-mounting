-- Data Cleanup Script: Fix existing bookings with inconsistent states
-- This script identifies and fixes common data inconsistencies

-- Create a cleanup function that can be called periodically
CREATE OR REPLACE FUNCTION public.cleanup_booking_inconsistencies()
RETURNS TABLE(
    cleanup_type TEXT,
    booking_id UUID,
    old_status TEXT,
    new_status TEXT,
    description TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    booking_record RECORD;
    transaction_record RECORD;
    cleanup_count INTEGER := 0;
BEGIN
    -- Log cleanup start
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NULL, 'system', 'Starting booking consistency cleanup', 'sent', NULL);

    -- Fix 1: Bookings with payment_intent but wrong status
    FOR booking_record IN 
        SELECT b.id, b.status, b.payment_status, b.payment_intent_id
        FROM bookings b
        WHERE b.payment_intent_id IS NOT NULL 
        AND b.status = 'pending'
    LOOP
        -- Check if there's an authorized transaction
        SELECT t.* INTO transaction_record
        FROM transactions t 
        WHERE t.booking_id = booking_record.id 
        AND t.payment_intent_id = booking_record.payment_intent_id
        AND t.status = 'authorized'
        LIMIT 1;
        
        IF FOUND THEN
            -- Update booking to payment_authorized
            UPDATE bookings 
            SET status = 'payment_authorized'::booking_status,
                payment_status = 'authorized'
            WHERE id = booking_record.id;
            
            cleanup_count := cleanup_count + 1;
            
            RETURN QUERY SELECT 
                'status_correction'::TEXT,
                booking_record.id,
                booking_record.status::TEXT,
                'payment_authorized'::TEXT,
                'Fixed booking with authorized payment but pending status'::TEXT;
        END IF;
    END LOOP;

    -- Fix 2: Bookings with completed transactions but wrong status
    FOR booking_record IN 
        SELECT DISTINCT b.id, b.status, b.payment_status
        FROM bookings b
        INNER JOIN transactions t ON b.id = t.booking_id
        WHERE t.status = 'completed'
        AND b.status NOT IN ('confirmed', 'completed')
    LOOP
        -- Update booking to confirmed
        UPDATE bookings 
        SET status = 'confirmed'::booking_status,
            payment_status = 'completed'
        WHERE id = booking_record.id;
        
        cleanup_count := cleanup_count + 1;
        
        RETURN QUERY SELECT 
            'payment_completion'::TEXT,
            booking_record.id,
            booking_record.status::TEXT,
            'confirmed'::TEXT,
            'Fixed booking with completed payment'::TEXT;
    END LOOP;

    -- Fix 3: Sync payment_status with latest transaction status
    FOR booking_record IN 
        SELECT b.id, b.payment_status, t.status as transaction_status
        FROM bookings b
        INNER JOIN transactions t ON b.id = t.booking_id
        WHERE b.payment_status::TEXT != t.status::TEXT
        AND t.created_at = (
            SELECT MAX(t2.created_at) 
            FROM transactions t2 
            WHERE t2.booking_id = b.id
        )
    LOOP
        -- Update booking payment_status to match latest transaction
        UPDATE bookings 
        SET payment_status = booking_record.transaction_status
        WHERE id = booking_record.id;
        
        cleanup_count := cleanup_count + 1;
        
        RETURN QUERY SELECT 
            'payment_status_sync'::TEXT,
            booking_record.id,
            booking_record.payment_status::TEXT,
            booking_record.transaction_status::TEXT,
            'Synced payment status with latest transaction'::TEXT;
    END LOOP;

    -- Fix 4: Remove orphaned transactions
    FOR transaction_record IN 
        SELECT t.id, t.booking_id, t.status, t.amount
        FROM transactions t
        LEFT JOIN bookings b ON t.booking_id = b.id
        WHERE b.id IS NULL
    LOOP
        -- Delete orphaned transaction
        DELETE FROM transactions WHERE id = transaction_record.id;
        
        cleanup_count := cleanup_count + 1;
        
        RETURN QUERY SELECT 
            'orphan_removal'::TEXT,
            transaction_record.booking_id,
            'orphaned'::TEXT,
            'deleted'::TEXT,
            ('Removed orphaned transaction: $' || transaction_record.amount::TEXT)::TEXT;
    END LOOP;

    -- Log cleanup completion
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NULL, 'system', 'Booking cleanup completed: ' || cleanup_count || ' items fixed', 'sent', NULL);

    RETURN;
END;
$$;

-- Create a function to check for inconsistencies without fixing them
CREATE OR REPLACE FUNCTION public.check_booking_inconsistencies()
RETURNS TABLE(
    issue_type TEXT,
    booking_id UUID,
    current_status TEXT,
    recommended_action TEXT,
    details TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check 1: Bookings with payment_intent but pending status
    RETURN QUERY
    SELECT 
        'pending_with_payment'::TEXT,
        b.id,
        b.status::TEXT,
        'Update to payment_authorized'::TEXT,
        ('Payment Intent: ' || COALESCE(b.payment_intent_id, 'none'))::TEXT
    FROM bookings b
    LEFT JOIN transactions t ON b.id = t.booking_id AND t.status = 'authorized'
    WHERE b.payment_intent_id IS NOT NULL 
    AND b.status = 'pending'
    AND t.id IS NOT NULL;

    -- Check 2: Mismatched payment statuses
    RETURN QUERY
    SELECT 
        'payment_status_mismatch'::TEXT,
        b.id,
        (b.payment_status::TEXT || ' vs ' || t.status::TEXT),
        'Sync payment status'::TEXT,
        'Latest transaction status differs from booking'::TEXT
    FROM bookings b
    INNER JOIN transactions t ON b.id = t.booking_id
    WHERE b.payment_status::TEXT != t.status::TEXT
    AND t.created_at = (
        SELECT MAX(t2.created_at) 
        FROM transactions t2 
        WHERE t2.booking_id = b.id
    );

    -- Check 3: Orphaned transactions
    RETURN QUERY
    SELECT 
        'orphaned_transaction'::TEXT,
        t.booking_id,
        t.status::TEXT,
        'Delete transaction'::TEXT,
        ('Amount: $' || t.amount::TEXT)::TEXT
    FROM transactions t
    LEFT JOIN bookings b ON t.booking_id = b.id
    WHERE b.id IS NULL;

    RETURN;
END;
$$;

-- Run the consistency check to see current state
SELECT * FROM public.check_booking_inconsistencies();