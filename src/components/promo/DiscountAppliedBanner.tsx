import React, { useEffect, useState } from 'react';
import { BadgePercent, X } from 'lucide-react';

const DISMISS_KEY = 'discount_applied_banner_dismissed_v1';

export const DiscountAppliedBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  };

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Discount already applied"
      className={`relative w-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-md transition-all duration-500 ease-out ${
        mounted ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
      } overflow-hidden`}
    >
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm sm:text-base">
        <BadgePercent className="h-5 w-5 shrink-0 text-yellow-300" />
        <span className="font-semibold text-center">
          <span className="font-bold">20% OFF</span> is already applied in price
        </span>
      </div>

      <button
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default DiscountAppliedBanner;
