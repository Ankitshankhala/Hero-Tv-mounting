-- Test direct booking insertion for guest users
CREATE OR REPLACE FUNCTION test_guest_booking_insertion() 
RETURNS text AS $$
DECLARE
  test_booking_id uuid;
  test_service_id uuid;
BEGIN
  -- Get a valid service ID first
  SELECT id INTO test_service_id FROM services WHERE is_active = true LIMIT 1;
  
  IF test_service_id IS NULL THEN
    RETURN 'ERROR: No active services found';
  END IF;
  
  -- Try to insert a test booking as a guest
  INSERT INTO bookings (
    customer_id,
    service_id,
    scheduled_date,
    scheduled_start,
    location_notes,
    status,
    payment_status,
    requires_manual_payment,
    guest_customer_info
  ) VALUES (
    NULL, -- guest user
    test_service_id,
    CURRENT_DATE + 1,
    '14:00:00',
    'Test location',
    'payment_pending',
    'pending',
    false,
    jsonb_build_object(
      'email', 'test@example.com',
      'name', 'Test User',
      'phone', '1234567890',
      'address', 'Test Address',
      'city', 'Test City',
      'zipcode', '12345'
    )
  ) RETURNING id INTO test_booking_id;
  
  -- Clean up the test booking
  DELETE FROM bookings WHERE id = test_booking_id;
  
  RETURN 'SUCCESS: Guest booking insertion works';
  
EXCEPTION WHEN OTHERS THEN
  RETURN format('ERROR: %s', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;