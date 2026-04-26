import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TestTube, Zap } from 'lucide-react';
import { useStripeMode } from '@/hooks/useStripeMode';

/**
 * Shows the current Stripe mode (TEST vs LIVE), reading from the runtime
 * `app_settings.stripe_mode` row via `useStripeMode`. Updates instantly
 * across tabs when an admin flips the toggle.
 */
export const StripeModeBadge: React.FC<{ className?: string }> = ({ className }) => {
  const { mode } = useStripeMode();
  const isTest = mode === 'test';

  return (
    <Badge
      variant="outline"
      className={
        (className ? className + ' ' : '') +
        (isTest
          ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          : 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300') +
        ' flex items-center gap-1.5 font-semibold tracking-wide uppercase text-xs'
      }
      title={
        isTest
          ? 'Stripe is in TEST mode. No real charges are being made.'
          : 'Stripe is in LIVE mode. Real charges are being made.'
      }
    >
      {isTest ? <TestTube className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
      Stripe: {isTest ? 'Test' : 'Live'}
    </Badge>
  );
};
