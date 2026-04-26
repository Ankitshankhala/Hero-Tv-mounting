import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TestTube, Zap } from 'lucide-react';
import { STRIPE_MODE } from '@/lib/stripe';

/**
 * Shows the current Stripe mode (TEST vs LIVE).
 *
 * - LIVE: green badge — real money is moving.
 * - TEST: amber badge — safe to use Stripe test cards (e.g. 4242 4242 4242 4242).
 *
 * Controlled by VITE_STRIPE_MODE in .env. The backend STRIPE_MODE secret
 * must match this value, otherwise frontend and edge functions will
 * disagree about which Stripe environment they are talking to.
 */
export const StripeModeBadge: React.FC<{ className?: string }> = ({ className }) => {
  const isTest = STRIPE_MODE === 'test';

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
