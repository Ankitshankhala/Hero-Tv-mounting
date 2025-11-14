import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount?: number;
  min_order_amount?: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
  usage_limit_total?: number;
  usage_limit_per_customer: number;
  usage_count: number;
  city_restrictions?: string[];
  created_at: string;
  created_by?: string;
}

export interface CouponUsage {
  id: string;
  customer_email: string;
  discount_amount: number;
  order_total: number;
  used_at: string;
  booking_id?: string;
}

export interface CouponAnalytics {
  totalActiveCoupons: number;
  totalRedemptionsThisMonth: number;
  totalDiscountGivenThisMonth: number;
  mostUsedCoupon: string;
}

export const useCoupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons((data || []) as Coupon[]);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      toast({
        title: 'Error',
        description: 'Failed to load coupons',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createCoupon = async (couponData: Omit<Coupon, 'id' | 'usage_count' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .insert([couponData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Coupon created successfully',
      });
      
      await fetchCoupons();
      return data;
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create coupon',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateCoupon = async (id: string, updates: Partial<Coupon>) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Coupon updated successfully',
      });
      
      await fetchCoupons();
    } catch (error: any) {
      console.error('Error updating coupon:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update coupon',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const toggleCouponStatus = async (id: string, currentStatus: boolean) => {
    await updateCoupon(id, { is_active: !currentStatus });
  };

  const deleteCoupon = async (id: string) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Coupon deactivated successfully',
      });
      
      await fetchCoupons();
    } catch (error: any) {
      console.error('Error deleting coupon:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete coupon',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const fetchCouponUsage = async (couponId: string): Promise<CouponUsage[]> => {
    try {
      const { data, error } = await supabase
        .from('coupon_usage')
        .select('*')
        .eq('coupon_id', couponId)
        .order('used_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching coupon usage:', error);
      return [];
    }
  };

  const fetchCouponAnalytics = async (): Promise<CouponAnalytics> => {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get active coupons count
      const { count: activeCount } = await supabase
        .from('coupons')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get this month's usage
      const { data: monthUsage } = await supabase
        .from('coupon_usage')
        .select('discount_amount')
        .gte('used_at', firstDayOfMonth.toISOString());

      const totalRedemptionsThisMonth = monthUsage?.length || 0;
      const totalDiscountGivenThisMonth = monthUsage?.reduce((sum, usage) => sum + Number(usage.discount_amount), 0) || 0;

      // Get most used coupon
      const { data: usageStats } = await supabase
        .from('coupons')
        .select('code, usage_count')
        .order('usage_count', { ascending: false })
        .limit(1);

      return {
        totalActiveCoupons: activeCount || 0,
        totalRedemptionsThisMonth,
        totalDiscountGivenThisMonth,
        mostUsedCoupon: usageStats?.[0]?.code || 'N/A',
      };
    } catch (error) {
      console.error('Error fetching coupon analytics:', error);
      return {
        totalActiveCoupons: 0,
        totalRedemptionsThisMonth: 0,
        totalDiscountGivenThisMonth: 0,
        mostUsedCoupon: 'N/A',
      };
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  return {
    coupons,
    loading,
    fetchCoupons,
    createCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon,
    fetchCouponUsage,
    fetchCouponAnalytics,
  };
};
