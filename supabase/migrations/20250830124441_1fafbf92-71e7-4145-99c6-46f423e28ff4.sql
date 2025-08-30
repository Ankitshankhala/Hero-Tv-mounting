-- Create trigger to auto-promote bookings when transactions complete
CREATE OR REPLACE FUNCTION public.auto_promote_booking_on_transaction_update()
RETURNS TRIGGER AS $$
DECLARE
  booking_record RECORD;
BEGIN
  -- Only process when transaction status changes to 'authorized' or 'completed'
  IF NEW.status IN ('authorized', 'completed') AND OLD.status != NEW.status THEN
    
    -- Get the associated booking
    SELECT * INTO booking_record
    FROM public.bookings 
    WHERE payment_intent_id = NEW.payment_intent_id
    LIMIT 1;
    
    -- If booking exists and is stuck in pending, promote it
    IF FOUND AND booking_record.status = 'pending' THEN
      
      -- Determine the new booking status
      DECLARE
        new_booking_status booking_status;
        new_payment_status text;
      BEGIN
        IF NEW.status = 'authorized' THEN
          new_booking_status := 'payment_authorized';
          new_payment_status := 'authorized';
        ELSE -- completed
          new_booking_status := 'confirmed';
          new_payment_status := 'completed';
        END IF;
        
        -- Update the booking
        UPDATE public.bookings 
        SET 
          status = new_booking_status,
          payment_status = new_payment_status,
          updated_at = now()
        WHERE id = booking_record.id;
        
        -- Log the auto-promotion
        INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
        VALUES (
          booking_record.id, 
          'system', 
          'Auto-promoted booking from pending to ' || new_booking_status::text || ' based on transaction ' || NEW.status::text, 
          'sent', 
          NULL
        );
      END;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (
    COALESCE(NEW.booking_id, booking_record.id), 
    'system', 
    'Auto-promotion trigger failed', 
    'failed', 
    SQLERRM
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_promote_booking ON public.transactions;
CREATE TRIGGER trigger_auto_promote_booking
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_promote_booking_on_transaction_update();

-- Function to repair payment inconsistencies
CREATE OR REPLACE FUNCTION public.repair_payment_inconsistencies()
RETURNS jsonb AS $$
DECLARE
  repair_results jsonb := '{
    "promoted_bookings": 0,
    "backfilled_payment_intents": 0,
    "standardized_statuses": 0,
    "errors": 0,
    "details": []
  }'::jsonb;
  
  booking_record RECORD;
  transaction_record RECORD;
  error_count INTEGER := 0;
  promoted_count INTEGER := 0;
  backfilled_count INTEGER := 0;
  standardized_count INTEGER := 0;
BEGIN
  -- 1. Promote bookings that are pending but have authorized/completed transactions
  FOR booking_record IN 
    SELECT DISTINCT b.id, b.status, b.payment_status, b.payment_intent_id,
           t.status as txn_status, t.transaction_type
    FROM public.bookings b
    LEFT JOIN public.transactions t ON (t.payment_intent_id = b.payment_intent_id)
    WHERE (t.status IN ('authorized','completed')) AND (b.status = 'pending')
  LOOP
    BEGIN
      DECLARE
        new_booking_status booking_status;
        new_payment_status text;
      BEGIN
        IF booking_record.txn_status = 'authorized' THEN
          new_booking_status := 'payment_authorized';
          new_payment_status := 'authorized';
        ELSE -- completed
          new_booking_status := 'confirmed';
          new_payment_status := 'completed';
        END IF;
        
        UPDATE public.bookings 
        SET 
          status = new_booking_status,
          payment_status = new_payment_status,
          updated_at = now()
        WHERE id = booking_record.id;
        
        promoted_count := promoted_count + 1;
        
        -- Log the repair
        INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
        VALUES (
          booking_record.id, 
          'system', 
          'Repair: promoted booking from pending to ' || new_booking_status::text, 
          'sent', 
          NULL
        );
      END;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (booking_record.id, 'system', 'Repair failed for booking promotion', 'failed', SQLERRM);
    END;
  END LOOP;

  -- 2. Backfill missing payment_intent_id in bookings where we can safely match
  FOR transaction_record IN 
    SELECT t.payment_intent_id, t.booking_id, t.amount, t.status
    FROM public.transactions t
    LEFT JOIN public.bookings b ON b.payment_intent_id = t.payment_intent_id
    WHERE b.id IS NULL 
      AND t.payment_intent_id IS NOT NULL 
      AND t.booking_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.bookings b2 
        WHERE b2.id = t.booking_id 
          AND b2.payment_intent_id IS NULL
      )
  LOOP
    BEGIN
      UPDATE public.bookings 
      SET payment_intent_id = transaction_record.payment_intent_id
      WHERE id = transaction_record.booking_id;
      
      backfilled_count := backfilled_count + 1;
      
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (
        transaction_record.booking_id, 
        'system', 
        'Repair: backfilled payment_intent_id', 
        'sent', 
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (transaction_record.booking_id, 'system', 'Repair failed for PI backfill', 'failed', SQLERRM);
    END;
  END LOOP;

  -- 3. Standardize 'completed' to 'captured' in booking payment_status
  UPDATE public.bookings 
  SET payment_status = 'captured'
  WHERE payment_status = 'completed';
  
  GET DIAGNOSTICS standardized_count = ROW_COUNT;

  -- Build final results
  repair_results := jsonb_set(repair_results, '{promoted_bookings}', promoted_count::text::jsonb);
  repair_results := jsonb_set(repair_results, '{backfilled_payment_intents}', backfilled_count::text::jsonb);
  repair_results := jsonb_set(repair_results, '{standardized_statuses}', standardized_count::text::jsonb);
  repair_results := jsonb_set(repair_results, '{errors}', error_count::text::jsonb);
  
  -- Log completion
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (
    NULL, 
    'system', 
    'Payment repair completed: ' || repair_results::text, 
    'sent', 
    NULL
  );
  
  RETURN repair_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;