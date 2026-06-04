import React from 'react';
import { BadgePercent } from 'lucide-react';

export const DiscountAppliedBanner: React.FC = () => {
  return (
    <div
      role="region"
      aria-label="Discount already applied"
      style={{ minHeight: '60px' }}
      className="w-full bg-[#4171F1] text-white shadow-md flex items-center justify-center px-4"
    >
      <div className="container mx-auto flex items-center justify-center gap-3 text-center">
        <BadgePercent className="h-6 w-6 shrink-0" />
        <span className="font-extrabold uppercase tracking-wide text-base sm:text-lg md:text-xl leading-tight">
          SAVE 20% TODAY – ALL PRICES ALREADY INCLUDE THE DISCOUNT – NO COUPON CODE NEEDED
        </span>
        <BadgePercent className="h-6 w-6 shrink-0 hidden sm:block" />
      </div>
    </div>
  );
};

export default DiscountAppliedBanner;
