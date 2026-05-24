import React from 'react';
import { Lock } from 'lucide-react';

/**
 * Visual row of supported card brand marks shown above the card input.
 * Pure presentation — communicates to users that all major brands are accepted
 * so they don't abandon checkout assuming their card type is unsupported.
 */
const brands: { label: string; bg: string; fg: string; text: string }[] = [
  { label: 'VISA', bg: '#1A1F71', fg: '#FFFFFF', text: 'VISA' },
  { label: 'Mastercard', bg: '#FFFFFF', fg: '#000000', text: 'MC' },
  { label: 'American Express', bg: '#2E77BC', fg: '#FFFFFF', text: 'AMEX' },
  { label: 'Discover', bg: '#FF6000', fg: '#FFFFFF', text: 'DISC' },
  { label: 'Diners Club', bg: '#0079BE', fg: '#FFFFFF', text: 'DINERS' },
  { label: 'JCB', bg: '#0E4C96', fg: '#FFFFFF', text: 'JCB' },
];

export const AcceptedCardsRow: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs text-muted-foreground mr-1">We accept:</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {brands.map((b) => (
          <span
            key={b.label}
            title={b.label}
            aria-label={b.label}
            className="inline-flex items-center justify-center rounded-[4px] border border-black/5 px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide shadow-sm"
            style={{ backgroundColor: b.bg, color: b.fg, minWidth: 40, height: 22 }}
          >
            {b.text}
          </span>
        ))}
      </div>
      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" /> Secured by Stripe
      </span>
    </div>
  );
};

export default AcceptedCardsRow;
