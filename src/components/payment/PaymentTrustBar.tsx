import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';

/**
 * Small trust strip rendered beneath the card input. Reassures customers that
 * card details are PCI-handled by Stripe and never stored on our servers.
 */
export const PaymentTrustBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground ${className}`}
    >
      <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600" />
      <span>
        Payments are encrypted with 256-bit SSL and processed by Stripe. Your card details never
        touch our servers. 3D Secure is supported where required by your bank.
      </span>
      <Lock className="h-3 w-3 mt-0.5 shrink-0" />
    </div>
  );
};

export default PaymentTrustBar;
