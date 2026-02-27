-- Remove the orphaned identity for admin@herotvmounting.com that's incorrectly linked to the captain account
DELETE FROM auth.identities 
WHERE identity_data->>'email' = 'admin@herotvmounting.com' 
AND user_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';