import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublicCoupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount: number | null;
  min_order_amount: number | null;
  valid_until: string;
  usage_limit_total: number | null;
  usage_count: number;
}

const scoreCoupon = (c: PublicCoupon) => {
  // Percentage coupons weighted higher to grab attention.
  const base = c.discount_type === 'percentage' ? c.discount_value * 2 : c.discount_value;
  return base;
};

export const usePublicCoupons = () => {
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoupons = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('coupons')
        .select(
          'id, code, discount_type, discount_value, max_discount_amount, min_order_amount, valid_until, usage_limit_total, usage_count'
        )
        .eq('is_active', true)
        .lte('valid_from', nowIso)
        .gte('valid_until', nowIso);

      if (error) throw error;

      const filtered = ((data || []) as PublicCoupon[])
        .filter((c) => c.usage_limit_total == null || c.usage_count < c.usage_limit_total)
        .sort((a, b) => {
          const s = scoreCoupon(b) - scoreCoupon(a);
          if (s !== 0) return s;
          return new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime();
        });

      setCoupons(filtered);
    } catch (err) {
      console.error('usePublicCoupons error', err);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  return {
    coupons,
    primary: coupons[0] ?? null,
    loading,
    refresh: fetchCoupons,
  };
};

export const formatCouponDiscount = (c: PublicCoupon) =>
  c.discount_type === 'percentage'
    ? `${c.discount_value}% OFF`
    : `$${c.discount_value} OFF`;

export const formatCouponMax = (c: PublicCoupon) =>
  c.max_discount_amount ? `Max $${c.max_discount_amount}` : null;

export const daysUntilExpiry = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
