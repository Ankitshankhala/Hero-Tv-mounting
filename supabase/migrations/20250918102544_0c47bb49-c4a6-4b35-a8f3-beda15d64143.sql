-- Remove comprehensive ZIP data tables completely
DROP TABLE IF EXISTS public.comprehensive_zcta_polygons CASCADE;
DROP TABLE IF EXISTS public.comprehensive_zip_codes CASCADE;

-- Log the removal
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Comprehensive ZIP data system completely removed', 'sent', NULL);