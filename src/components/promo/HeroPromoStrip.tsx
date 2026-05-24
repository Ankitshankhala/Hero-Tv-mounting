import React from 'react';
import { Copy, Tag, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  usePublicCoupons,
  formatCouponDiscount,
  formatCouponMax,
  daysUntilExpiry,
  type PublicCoupon,
} from '@/hooks/usePublicCoupons';

const CouponCard: React.FC<{ coupon: PublicCoupon }> = ({ coupon }) => {
  const { toast } = useToast();
  const days = daysUntilExpiry(coupon.valid_until);
  const max = formatCouponMax(coupon);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      toast({ title: 'Code copied!', description: `Use ${coupon.code} at checkout.` });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handleBook = () => {
    try {
      sessionStorage.setItem('pending_coupon', coupon.code);
    } catch {}
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-400/20 bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-blue-900/40 p-5 shadow-lg backdrop-blur-sm transition-all hover:border-blue-400/40 hover:shadow-blue-500/10">
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" aria-hidden />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-400/30">
            <Tag className="h-5 w-5 text-blue-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-white">{formatCouponDiscount(coupon)}</span>
              {max && (
                <span className="text-xs text-slate-300 rounded-full bg-white/5 px-2 py-0.5">{max}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <code className="font-mono text-sm font-semibold tracking-wider text-blue-200 bg-blue-500/10 ring-1 ring-blue-400/30 rounded-md px-2 py-0.5">
                {coupon.code}
              </code>
              {days <= 7 && (
                <span className="text-xs text-yellow-300/90">Ends in {days} day{days === 1 ? '' : 's'}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:flex-shrink-0">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 ring-1 ring-white/10 px-3 py-2 text-xs font-medium text-white transition-colors"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            onClick={handleBook}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors"
          >
            Book Now <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const HeroPromoStrip: React.FC = () => {
  const { coupons, loading } = usePublicCoupons();
  if (loading || coupons.length === 0) return null;
  const top = coupons.slice(0, 2);

  return (
    <section className="container mx-auto px-4 pt-6">
      <div className={`grid gap-4 ${top.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {top.map((c) => (
          <CouponCard key={c.id} coupon={c} />
        ))}
      </div>
    </section>
  );
};

export default HeroPromoStrip;
