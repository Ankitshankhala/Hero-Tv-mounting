-- Phase 1: Rename "TV Mounting" to "Mount TV" in database

-- Update the services table (source of truth)
UPDATE public.services 
SET name = 'Mount TV' 
WHERE name = 'TV Mounting';

-- Update historical booking_services records
UPDATE public.booking_services 
SET service_name = 'Mount TV' 
WHERE service_name = 'TV Mounting';

-- Log the migration
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status)
VALUES (NULL, 'system', 'Service renamed: TV Mounting -> Mount TV', 'sent');