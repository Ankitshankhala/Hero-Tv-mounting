-- =====================================================
-- COUPON SYSTEM - Complete Database Schema
-- =====================================================

-- 1. Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount_amount DECIMAL(10,2) CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  min_order_amount DECIMAL(10,2) DEFAULT 0 CHECK (min_order_amount >= 0),
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_limit_total INTEGER CHECK (usage_limit_total IS NULL OR usage_limit_total > 0),
  usage_limit_per_customer INTEGER NOT NULL DEFAULT 1 CHECK (usage_limit_per_customer > 0),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  city_restrictions TEXT[], -- Array of city names
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (valid_until > valid_from),
  CONSTRAINT percentage_has_max_discount CHECK (
    discount_type != 'percentage' OR max_discount_amount IS NOT NULL
  )
);

-- 2. Create coupon_services junction table (for service restrictions)
CREATE TABLE IF NOT EXISTS public.coupon_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(coupon_id, service_id)
);

-- 3. Create coupon_usage tracking table
CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_email VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  order_total DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- 4. Create coupon audit log
CREATE TABLE IF NOT EXISTS public.coupon_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Add coupon fields to bookings table
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id),
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2) DEFAULT 0 CHECK (coupon_discount >= 0),
  ADD COLUMN IF NOT EXISTS subtotal_before_discount DECIMAL(10,2);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active_valid ON public.coupons(is_active, valid_from, valid_until) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_coupons_city_restrictions ON public.coupons USING GIN(city_restrictions);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON public.coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_email ON public.coupon_usage(customer_email);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON public.coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_services_coupon_id ON public.coupon_services(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_services_service_id ON public.coupon_services(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_coupon_id ON public.bookings(coupon_id);

-- 7. Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_audit_log ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for coupons
CREATE POLICY "Public can view active valid coupons"
  ON public.coupons FOR SELECT
  TO public
  USING (is_active = true AND valid_from <= now() AND valid_until >= now());

CREATE POLICY "Admins have full access to coupons"
  ON public.coupons FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 9. RLS Policies for coupon_services
CREATE POLICY "Public can view coupon services"
  ON public.coupon_services FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage coupon services"
  ON public.coupon_services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 10. RLS Policies for coupon_usage
CREATE POLICY "Users can view their own coupon usage"
  ON public.coupon_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all coupon usage"
  ON public.coupon_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can insert coupon usage"
  ON public.coupon_usage FOR INSERT
  TO public
  WITH CHECK (true);

-- 11. RLS Policies for coupon_audit_log
CREATE POLICY "Admins can view audit log"
  ON public.coupon_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can insert audit log"
  ON public.coupon_audit_log FOR INSERT
  TO public
  WITH CHECK (true);

-- 12. Trigger: Auto-uppercase coupon codes
CREATE OR REPLACE FUNCTION public.uppercase_coupon_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code = UPPER(NEW.code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coupons_uppercase_code
  BEFORE INSERT OR UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_coupon_code();

-- 13. Trigger: Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_coupons_updated_at();

-- 14. Trigger: Increment usage count when coupon used
CREATE OR REPLACE FUNCTION public.increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.coupons
  SET usage_count = usage_count + 1
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_coupon_usage
  AFTER INSERT ON public.coupon_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_coupon_usage();

-- 15. Trigger: Audit log for coupon changes
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_coupons
  AFTER INSERT OR UPDATE OR DELETE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_coupon_changes();

-- 16. Function: Server-side coupon validation
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
$$ LANGUAGE plpgsql SECURITY DEFINER;