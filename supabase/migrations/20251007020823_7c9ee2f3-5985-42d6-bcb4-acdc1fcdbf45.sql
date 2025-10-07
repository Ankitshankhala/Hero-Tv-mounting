-- Fix delete_booking_with_cascade to remove references to non-existent tables
CREATE OR REPLACE FUNCTION public.delete_booking_with_cascade(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '{"success": false, "deleted_counts": {}}'::jsonb;
  sms_count integer := 0;
  invoice_items_count integer := 0;
  invoices_count integer := 0;
  booking_modifications_count integer := 0;
  invoice_modifications_count integer := 0;
  worker_bookings_count integer := 0;
  transactions_count integer := 0;
  booking_services_count integer := 0;
  booking_count integer := 0;
BEGIN
  -- Check if booking exists
  IF NOT EXISTS (SELECT 1 FROM bookings WHERE id = p_booking_id) THEN
    result := jsonb_set(result, '{error}', '"Booking not found"');
    RETURN result;
  END IF;

  -- Start transaction and delete in correct order to avoid foreign key violations
  
  -- 1. Delete SMS logs
  DELETE FROM sms_logs WHERE booking_id = p_booking_id;
  GET DIAGNOSTICS sms_count = ROW_COUNT;
  
  -- 2. Delete invoice items first (depends on invoices)
  DELETE FROM invoice_items 
  WHERE invoice_id IN (SELECT id FROM invoices WHERE booking_id = p_booking_id);
  GET DIAGNOSTICS invoice_items_count = ROW_COUNT;
  
  -- 3. Delete invoices
  DELETE FROM invoices WHERE booking_id = p_booking_id;
  GET DIAGNOSTICS invoices_count = ROW_COUNT;
  
  -- 4. Delete booking service modifications
  DELETE FROM booking_service_modifications WHERE booking_id = p_booking_id;
  GET DIAGNOSTICS booking_modifications_count = ROW_COUNT;
  
  -- 5. Delete invoice service modifications
  DELETE FROM invoice_service_modifications WHERE booking_id = p_booking_id;
  GET DIAGNOSTICS invoice_modifications_count = ROW_COUNT;
  
  -- 6. Delete worker bookings
  DELETE FROM worker_bookings WHERE booking_id = p_booking_id;
  GET DIAGNOSTICS worker_bookings_count = ROW_COUNT;
  
  -- 7. Delete transactions
  DELETE FROM transactions WHERE booking_id = p_booking_id;
  GET DIAGNOSTICS transactions_count = ROW_COUNT;
  
  -- 8. Delete booking services
  DELETE FROM booking_services WHERE booking_id = p_booking_id;
  GET DIAGNOSTICS booking_services_count = ROW_COUNT;
  
  -- 9. Finally delete the main booking record
  DELETE FROM bookings WHERE id = p_booking_id;
  GET DIAGNOSTICS booking_count = ROW_COUNT;
  
  -- Build result object
  result := jsonb_set(result, '{success}', 'true');
  result := jsonb_set(result, '{deleted_counts, sms_logs}', to_jsonb(sms_count));
  result := jsonb_set(result, '{deleted_counts, invoice_items}', to_jsonb(invoice_items_count));
  result := jsonb_set(result, '{deleted_counts, invoices}', to_jsonb(invoices_count));
  result := jsonb_set(result, '{deleted_counts, booking_modifications}', to_jsonb(booking_modifications_count));
  result := jsonb_set(result, '{deleted_counts, invoice_modifications}', to_jsonb(invoice_modifications_count));
  result := jsonb_set(result, '{deleted_counts, worker_bookings}', to_jsonb(worker_bookings_count));
  result := jsonb_set(result, '{deleted_counts, transactions}', to_jsonb(transactions_count));
  result := jsonb_set(result, '{deleted_counts, booking_services}', to_jsonb(booking_services_count));
  result := jsonb_set(result, '{deleted_counts, booking}', to_jsonb(booking_count));
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  result := jsonb_set(result, '{error}', to_jsonb(SQLERRM));
  RETURN result;
END;
$function$;