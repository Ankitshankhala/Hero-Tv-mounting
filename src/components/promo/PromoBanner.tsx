import React, { useEffect, useState } from 'react';
import { Copy, Sparkles, X, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  usePublicCoupons,
  formatCouponDiscount,
  formatCouponMax,
  daysUntilExpiry,
} from '@/hooks/usePublicCoupons';

const DISMISS_KEY = 'promo_dismissed_v1';

const getDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
  } catch {
    return [];
  }
};

export const PromoBanner: React.FC = () => {
  const { primary, loading } = usePublicCoupons();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDismissed(getDismissed());
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (loading || !primary || dismissed.includes(primary.id)) return null;

  const days = daysUntilExpiry(primary.valid_until);
  const showCountdown = days <= 7;
  const maxLabel = formatCouponMax(primary);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(primary.code);
      toast({ title: 'Code copied!', description: `Use ${primary.code} at checkout.` });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handleApply = () => {
    try {
      sessionStorage.setItem('pending_coupon', primary.code);
    } catch {}
    const services = document.getElementById('services');
    if (services) {
      services.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = `/?coupon=${primary.code}#services`;
    }
  };

  const handleDismiss = () => {
    const next = [...dismissed, primary.id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <div
      role="region"
      aria-label="Active promotion"
      className={`relative w-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-md transition-all duration-500 ease-out ${
        mounted ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
      } overflow-hidden`}
    >
      <div className="container mx-auto px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-yellow-300" />
          <span className="font-medium truncate">
            Save <span className="font-bold">{formatCouponDiscount(primary)}</span> with code
          </span>
          <code className="font-mono font-bold tracking-wider bg-white/15 ring-1 ring-white/30 rounded-md px-2 py-0.5 text-white">
            {primary.code}
          </code>
          {maxLabel && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/90">
              {maxLabel}
            </span>
          )}
          {showCountdown && (
            <span className="hidden md:inline-flex items-center rounded-full bg-yellow-400/20 ring-1 ring-yellow-300/40 px-2 py-0.5 text-xs text-yellow-100">
              Ends in {days} day{days === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-medium transition-colors"
            aria-label="Copy coupon code"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 rounded-md bg-white text-blue-700 hover:bg-blue-50 px-3 py-1 text-xs font-semibold shadow-sm transition-colors"
          >
            Apply Now <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        aria-label="Dismiss promotion"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default PromoBanner;
