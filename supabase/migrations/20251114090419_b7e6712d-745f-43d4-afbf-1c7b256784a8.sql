-- Fix Function Search Path Mutable warnings for coupon system functions

-- Fix uppercase_coupon_code function
CREATE OR REPLACE FUNCTION public.uppercase_coupon_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code = UPPER(NEW.code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix update_coupons_updated_at function
CREATE OR REPLACE FUNCTION public.update_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix increment_coupon_usage function
CREATE OR REPLACE FUNCTION public.increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.coupons
  SET usage_count = usage_count + 1
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix audit_coupon_changes function
CREATE OR REPLACE FUNCTION public.audit_coupon_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.coupon_audit_log (coupon_id, action, changed_by, changes)
    VALUES (NEW.id, 'CREATE', auth.uid(), to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.coupon_audit_log (coupon_id, action, changed_by, changes)
    VALUES (NEW.id, 'UPDATE', auth.uid(), jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    ));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.coupon_audit_log (coupon_id, action, changed_by, changes)
    VALUES (OLD.id, 'DELETE', auth.uid(), to_jsonb(OLD));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix is_coupon_valid function
CREATE OR REPLACE FUNCTION public.is_coupon_valid(
  p_code VARCHAR,
  p_customer_email VARCHAR,
  p_user_id UUID,
  p_cart_total DECIMAL,
  p_city VARCHAR,
  p_service_ids UUID[]
)
RETURNS TABLE (
  valid BOOLEAN,
  error_message TEXT,
  coupon_id UUID,
  discount_amount DECIMAL
) AS $$
DECLARE
  v_coupon RECORD;
  v_usage_count INTEGER;
  v_discount DECIMAL;
  v_has_service_restriction BOOLEAN;
  v_service_match BOOLEAN;
BEGIN
  -- Normalize inputs
  p_code := UPPER(TRIM(p_code));
  p_customer_email := LOWER(TRIM(p_customer_email));

  -- Fetch coupon
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE code = p_code;

  -- Check: Coupon exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid coupon code'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  -- Check: Is active
  IF v_coupon.is_active = false THEN
    RETURN QUERY SELECT false, 'This coupon is currently inactive'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  -- Check: Date validity
  IF now() < v_coupon.valid_from THEN
    RETURN QUERY SELECT false, 'This coupon is not yet valid'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  IF now() > v_coupon.valid_until THEN
    RETURN QUERY SELECT false, 'This coupon has expired'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  -- Check: Minimum order amount
  IF p_cart_total < v_coupon.min_order_amount THEN
    RETURN QUERY SELECT false, 
      format('Minimum order amount of $%s required', v_coupon.min_order_amount)::TEXT,
      NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  -- Check: Total usage limit
  IF v_coupon.usage_limit_total IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit_total THEN
    RETURN QUERY SELECT false, 'This coupon has reached its usage limit'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  -- Check: Per-customer usage limit
  SELECT COUNT(*) INTO v_usage_count
  FROM public.coupon_usage
  WHERE coupon_id = v_coupon.id
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR customer_email = p_customer_email
    );

  IF v_usage_count >= v_coupon.usage_limit_per_customer THEN
    RETURN QUERY SELECT false, 'You have already used this coupon'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  -- Check: City restrictions
  IF v_coupon.city_restrictions IS NOT NULL 
     AND array_length(v_coupon.city_restrictions, 1) > 0 
     AND NOT (p_city = ANY(v_coupon.city_restrictions)) THEN
    RETURN QUERY SELECT false, 'This coupon is not valid for your location'::TEXT, NULL::UUID, 0::DECIMAL;
    RETURN;
  END IF;

  -- Check: Service restrictions
  SELECT EXISTS (
    SELECT 1 FROM public.coupon_services WHERE coupon_id = v_coupon.id
  ) INTO v_has_service_restriction;

  IF v_has_service_restriction THEN
    SELECT EXISTS (
      SELECT 1 FROM public.coupon_services cs
      WHERE cs.coupon_id = v_coupon.id
        AND cs.service_id = ANY(p_service_ids)
    ) INTO v_service_match;

    IF NOT v_service_match THEN
      RETURN QUERY SELECT false, 'This coupon is not valid for the selected services'::TEXT, NULL::UUID, 0::DECIMAL;
      RETURN;
    END IF;
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'fixed' THEN
    v_discount := LEAST(v_coupon.discount_value, p_cart_total);
  ELSE -- percentage
    v_discount := (p_cart_total * v_coupon.discount_value) / 100;
    IF v_coupon.max_discount_amount IS NOT NULL THEN
      v_discount := LEAST(v_discount, v_coupon.max_discount_amount);
    END IF;
    v_discount := LEAST(v_discount, p_cart_total);
  END IF;

  v_discount := ROUND(v_discount, 2);

  -- Return success
  RETURN QUERY SELECT true, NULL::TEXT, v_coupon.id, v_discount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;