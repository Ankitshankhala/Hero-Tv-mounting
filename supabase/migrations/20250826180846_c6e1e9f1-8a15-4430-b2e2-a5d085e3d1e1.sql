-- Step 1: Remove duplicate email logs, keeping the earliest one for each booking/email combination
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY booking_id, recipient_email, email_type 
           ORDER BY created_at ASC
         ) as rn
  FROM email_logs
  WHERE booking_id IS NOT NULL 
    AND email_type = 'worker_assignment'
)
DELETE FROM email_logs 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE email_logs 
ADD CONSTRAINT unique_booking_recipient_email_type 
UNIQUE (booking_id, recipient_email, email_type);