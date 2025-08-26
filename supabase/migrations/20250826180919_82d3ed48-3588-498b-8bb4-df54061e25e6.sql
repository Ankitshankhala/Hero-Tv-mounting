-- Step 1: Remove ALL duplicate email logs, handling null/unknown recipients
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY 
             COALESCE(booking_id::text, 'null'),
             COALESCE(recipient_email, 'unknown'), 
             COALESCE(email_type, 'general')
           ORDER BY created_at ASC
         ) as rn
  FROM email_logs
)
DELETE FROM email_logs 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Add unique constraint to prevent future duplicates (only where booking_id is not null)
CREATE UNIQUE INDEX unique_booking_recipient_email_type 
ON email_logs (booking_id, recipient_email, email_type) 
WHERE booking_id IS NOT NULL;