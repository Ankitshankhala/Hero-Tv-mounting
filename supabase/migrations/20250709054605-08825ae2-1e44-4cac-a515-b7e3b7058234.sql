-- Add payment_pending status to booking_status enum
ALTER TYPE booking_status ADD VALUE 'payment_pending' AFTER 'pending';