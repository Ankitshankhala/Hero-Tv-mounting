-- Function to correct a specific booking's payment status (admin only)
CREATE OR REPLACE FUNCTION public.fix_booking_payment_status(
  p_booking_id uuid,
  p_payment_intent_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '{"success": false}'::jsonb;
  booking_updated boolean := false;
  transaction_updated boolean := false;
BEGIN
  -- Update the booking status
  UPDATE public.bookings 
  SET status = 'payment_authorized', 
      payment_status = 'authorized'
  WHERE id = p_booking_id;
  
  GET DIAGNOSTICS booking_updated = FOUND;
  
  -- Update the transaction status
  UPDATE public.transactions 
  SET status = 'authorized'
  WHERE payment_intent_id = p_payment_intent_id;
  
  GET DIAGNOSTICS transaction_updated = FOUND;
  
  -- Build result
  result := jsonb_set(result, '{success}', 'true');
  result := jsonb_set(result, '{booking_updated}', to_jsonb(booking_updated));
  result := jsonb_set(result, '{transaction_updated}', to_jsonb(transaction_updated));
  result := jsonb_set(result, '{booking_id}', to_jsonb(p_booking_id));
  result := jsonb_set(result, '{payment_intent_id}', to_jsonb(p_payment_intent_id));
  
  -- Log the correction
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (p_booking_id, 'system', 'Booking payment status corrected via fix function', 'sent', NULL);
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  result := jsonb_set(result, '{error}', to_jsonb(SQLERRM));
  RETURN result;
END;
$$;