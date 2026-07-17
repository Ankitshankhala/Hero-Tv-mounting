CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m_start   timestamptz := date_trunc('month', now());
  lm_start  timestamptz := date_trunc('month', now()) - interval '1 month';
  prev_end  timestamptz := (date_trunc('month', now()) - interval '1 month') + (now() - date_trunc('month', now()));
  rev_now numeric; rev_prev numeric; rev_all numeric; jobs_now bigint; jobs_prev bigint;
  cust_now bigint; cust_prev bigint; upcoming bigint; unassigned bigint;
  pend bigint; workers bigint; total_cust bigint; avg_rt numeric; reviews_n bigint;
BEGIN
  IF get_current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT coalesce(sum(amount),0) INTO rev_now  FROM transactions
    WHERE transaction_type='capture' AND status='completed' AND created_at >= m_start;
  SELECT coalesce(sum(amount),0) INTO rev_prev FROM transactions
    WHERE transaction_type='capture' AND status='completed' AND created_at >= lm_start AND created_at < prev_end;
  SELECT coalesce(sum(amount),0) INTO rev_all FROM transactions
    WHERE transaction_type='capture' AND status='completed';

  SELECT count(DISTINCT booking_id) INTO jobs_now  FROM transactions
    WHERE transaction_type='capture' AND status='completed' AND created_at >= m_start;
  SELECT count(DISTINCT booking_id) INTO jobs_prev FROM transactions
    WHERE transaction_type='capture' AND status='completed' AND created_at >= lm_start AND created_at < prev_end;

  SELECT count(DISTINCT lower(coalesce(nullif(b.guest_customer_info->>'email',''), u.email)))
    INTO cust_now FROM bookings b LEFT JOIN users u ON u.id=b.customer_id
    WHERE b.created_at >= m_start AND coalesce(nullif(b.guest_customer_info->>'email',''), u.email) IS NOT NULL;
  SELECT count(DISTINCT lower(coalesce(nullif(b.guest_customer_info->>'email',''), u.email)))
    INTO cust_prev FROM bookings b LEFT JOIN users u ON u.id=b.customer_id
    WHERE b.created_at >= lm_start AND b.created_at < prev_end
      AND coalesce(nullif(b.guest_customer_info->>'email',''), u.email) IS NOT NULL;

  SELECT count(*) INTO upcoming FROM bookings
    WHERE payment_status='authorized' AND status NOT IN ('completed','cancelled');
  SELECT count(*) INTO unassigned FROM bookings
    WHERE payment_status='authorized' AND status NOT IN ('completed','cancelled') AND worker_id IS NULL;
  SELECT count(*) INTO pend FROM bookings WHERE status='pending';
  SELECT count(*) INTO workers FROM users WHERE role='worker' AND is_active;
  SELECT count(DISTINCT lower(coalesce(nullif(b.guest_customer_info->>'email',''), u.email)))
    INTO total_cust FROM bookings b LEFT JOIN users u ON u.id=b.customer_id
    WHERE coalesce(nullif(b.guest_customer_info->>'email',''), u.email) IS NOT NULL;
  SELECT round(coalesce(avg(reviews.rating),0),1), count(*) INTO avg_rt, reviews_n
    FROM reviews WHERE reviews.status='approved';

  RETURN jsonb_build_object(
    'revenue_this_month', rev_now,
    'revenue_last_month', rev_prev,
    'revenue_all_time', rev_all,
    'revenue_delta_pct', CASE WHEN rev_prev=0 THEN NULL ELSE round((rev_now-rev_prev)/rev_prev*100,1) END,
    'jobs_completed_this_month', jobs_now,
    'jobs_completed_last_month', jobs_prev,
    'jobs_completed_delta_pct', CASE WHEN jobs_prev=0 THEN NULL ELSE round((jobs_now-jobs_prev)::numeric/jobs_prev*100,1) END,
    'new_customers_this_month', cust_now,
    'new_customers_last_month', cust_prev,
    'new_customers_delta_pct', CASE WHEN cust_prev=0 THEN NULL ELSE round((cust_now-cust_prev)::numeric/cust_prev*100,1) END,
    'upcoming_jobs', upcoming, 'unassigned_jobs', unassigned, 'pending_bookings', pend,
    'active_workers', workers, 'total_customers', total_cust,
    'avg_rating', avg_rt, 'review_count', reviews_n,
    'comparison_basis', 'month_to_date', 'generated_at', now()
  );
END;
$function$;