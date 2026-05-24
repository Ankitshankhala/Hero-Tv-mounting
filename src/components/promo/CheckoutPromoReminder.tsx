import React, { useState } from 'react';
import { Loader2, Sparkles, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  usePublicCoupons,
  formatCouponDiscount,
  formatCouponMax,
} from '@/hooks/usePublicCoupons';

interface Props {
  cartTotal: number;
  customerEmail: string;
  userId?: string;
  zipcode: string;
  city: string;
  serviceIds: string[];
  isApplied: boolean;
  onCouponApplied: (code: string, discount: number, couponId: string) => void;
}

export const CheckoutPromoReminder: React.FC<Props> = ({
  cartTotal,
  customerEmail,
  userId,
  zipcode,
  city,
  serviceIds,
  isApplied,
  onCouponApplied,
}) => {
  const { coupons, loading } = usePublicCoupons();
  const { toast } = useToast();
  const [applyingCode, setApplyingCode] = useState<string | null>(null);

  if (isApplied || loading || coupons.length === 0) return null;

  const pending =
    typeof window !== 'undefined' ? sessionStorage.getItem('pending_coupon') : null;
  const ordered = pending
    ? [...coupons].sort((a, b) => (a.code === pending ? -1 : b.code === pending ? 1 : 0))
    : coupons;
  const visible = ordered.slice(0, 3);

  const handleApply = async (code: string) => {
    if (!customerEmail) {
      toast({
        title: 'Enter your email first',
        description: 'We need your email to apply this coupon.',
      });
      return;
    }
    setApplyingCode(code);
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: {
          code,
          customerEmail,
          userId: userId || null,
          cartTotal,
          zipcode,
          city,
          serviceIds,
        },
      });
      if (error) throw error;
      if (data?.valid) {
        onCouponApplied(data.couponDetails.code, data.discountAmount, data.couponId);
        toast({
          title: 'Coupon applied!',
          description: `You saved $${data.discountAmount.toFixed(2)}`,
        });
        try {
          sessionStorage.removeItem('pending_coupon');
        } catch {}
      } else {
        toast({
          title: 'Invalid Coupon',
          description: data?.errorMessage || 'Could not apply this code.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Apply coupon error', err);
      toast({
        title: 'Error',
        description: 'Failed to apply coupon.',
        variant: 'destructive',
      });
    } finally {
      setApplyingCode(null);
    }
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
        <Sparkles className="h-4 w-4 text-blue-600" />
        Available offers — tap to apply
      </div>
      <div className="flex flex-col gap-2">
        {visible.map((c) => {
          const max = formatCouponMax(c);
          const busy = applyingCode === c.code;
          const isPending = pending === c.code;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleApply(c.code)}
              disabled={busy}
              className="group flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-white px-3 py-2.5 text-left hover:border-blue-400 hover:shadow-sm transition-all disabled:opacity-60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Tag className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-sm font-bold tracking-wider text-blue-700">
                      {c.code}
                    </code>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCouponDiscount(c)}
                    </span>
                    {isPending && (
                      <span className="text-[10px] uppercase tracking-wider bg-blue-600 text-white rounded px-1.5 py-0.5">
                        Selected
                      </span>
                    )}
                  </div>
                  {max && <div className="text-xs text-slate-500 mt-0.5">{max}</div>}
                </div>
              </div>
              <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700 shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CheckoutPromoReminder;
