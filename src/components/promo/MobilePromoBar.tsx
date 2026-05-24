import React, { useEffect, useState } from 'react';
import { Copy, X, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  usePublicCoupons,
  formatCouponDiscount,
} from '@/hooks/usePublicCoupons';

const DISMISS_KEY = 'promo_mobile_dismissed_v1';

const getDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
  } catch {
    return [];
  }
};

export const MobilePromoBar: React.FC = () => {
  const { primary, loading } = usePublicCoupons();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(getDismissed());
  }, []);

  if (loading || !primary || dismissed.includes(primary.id)) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(primary.code);
      toast({ title: 'Code copied!', description: primary.code });
    } catch {
      /* noop */
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
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="mx-3 mb-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Tag className="h-4 w-4 text-yellow-300 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-semibold">{formatCouponDiscount(primary)}</span>
            <span className="mx-1.5 text-white/70">·</span>
            <code className="font-mono font-bold tracking-wider">{primary.code}</code>
          </div>
          <button
            onClick={handleCopy}
            className="rounded-md bg-white/15 hover:bg-white/25 p-1.5 transition-colors"
            aria-label="Copy code"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-md p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobilePromoBar;
