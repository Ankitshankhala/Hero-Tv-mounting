-- Debug function to test guest booking policy
CREATE OR REPLACE FUNCTION debug_guest_booking_insertion(
  p_customer_id uuid,
  p_guest_customer_info jsonb
) RETURNS text AS $$
BEGIN
  RAISE NOTICE 'Debug guest booking: customer_id=%, auth.uid()=%, guest_info=%', 
    p_customer_id, auth.uid(), p_guest_customer_info;
    
  -- Test the exact RLS policy condition
  IF ((auth.uid() IS NULL) AND 
      (p_customer_id IS NULL) AND 
      (p_guest_customer_info IS NOT NULL) AND 
      ((p_guest_customer_info ->> 'email') IS NOT NULL) AND 
      ((p_guest_customer_info ->> 'name') IS NOT NULL) AND 
      ((p_guest_customer_info ->> 'phone') IS NOT NULL)) THEN
    RETURN 'GUEST_POLICY_PASSED';
  ELSE
    RETURN format('GUEST_POLICY_FAILED: auth.uid()=%s, customer_id=%s, guest_info_null=%s, email=%s, name=%s, phone=%s', 
      auth.uid(), 
      p_customer_id,
      p_guest_customer_info IS NULL,
      p_guest_customer_info ->> 'email',
      p_guest_customer_info ->> 'name', 
      p_guest_customer_info ->> 'phone'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;