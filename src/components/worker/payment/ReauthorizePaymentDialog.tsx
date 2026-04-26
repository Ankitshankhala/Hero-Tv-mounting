import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, AlertTriangle, DollarSign, Loader2 } from 'lucide-react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReauthorizePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking_id: string;
  original_amount: number;
  new_amount: number;
  client_secret: string;
  old_payment_intent: string;
  new_payment_intent: string;
  onSuccess?: () => void;
}

/**
 * Saved-card 3DS reauthorization.
 *
 * The pending PaymentIntent was created server-side with the customer's saved
 * payment method already attached. We must NOT collect a new card here — that
 * would override the saved card and (a) require the worker to type a card they
 * don't own, (b) break the engine's finalize-reauthorization handoff.
 *
 * Instead we call `stripe.handleNextAction({ clientSecret })` which opens
 * Stripe's hosted 3DS challenge UI for the already-attached saved card.
 * If the PI is in `requires_capture` directly (rare — happens when the engine
 * created an unconfirmed pending PI), we call `stripe.confirmCardPayment`
 * with no payment_method override so Stripe uses the attached saved card.
 */
export const ReauthorizePaymentDialog = ({
  isOpen,
  onClose,
  booking_id,
  original_amount,
  new_amount,
  client_secret,
  old_payment_intent,
  new_payment_intent,
  onSuccess,
}: ReauthorizePaymentDialogProps) => {
  const [processing, setProcessing] = useState(false);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStripeLoading(true);
    loadStripe(STRIPE_PUBLISHABLE_KEY)
      .then((s) => {
        if (cancelled) return;
        if (!s) {
          toast({
            title: 'Stripe Error',
            description: 'Failed to initialize Stripe',
            variant: 'destructive',
          });
        }
        setStripe(s);
      })
      .finally(() => {
        if (!cancelled) setStripeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, toast]);

  const finalizeOnEngine = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke(
      'payment-engine',
      {
        body: {
          action: 'finalize-reauthorization',
          bookingId: booking_id,
          new_payment_intent_id: new_payment_intent,
        },
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
      },
    );

    if (finalizeError || !finalizeData?.success) {
      const msg =
        finalizeData?.error || finalizeError?.message || 'Failed to finalize re-authorization';
      throw new Error(msg);
    }
  };

  const handleAuthorize = async () => {
    if (!stripe) {
      toast({
        title: 'Stripe Not Ready',
        description: 'Please wait a moment and try again.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      // Inspect current PI status. The engine may have given us either:
      //   a) requires_action  — off-session was created+confirmed and Stripe wants 3DS
      //   b) requires_confirmation — engine created an unconfirmed PI as fallback
      const { paymentIntent: currentPI, error: retrieveErr } = await stripe.retrievePaymentIntent(
        client_secret,
      );

      if (retrieveErr || !currentPI) {
        throw new Error(retrieveErr?.message || 'Could not retrieve payment intent');
      }

      let resultPI = currentPI;

      if (currentPI.status === 'requires_action') {
        // Open Stripe's hosted 3DS challenge for the saved card.
        const { error, paymentIntent } = await stripe.handleNextAction({
          clientSecret: client_secret,
        });
        if (error) throw new Error(error.message);
        if (paymentIntent) resultPI = paymentIntent;
      } else if (currentPI.status === 'requires_confirmation') {
        // Confirm using the already-attached saved payment method.
        // Passing no payment_method tells Stripe to use the one on the PI.
        const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret);
        if (error) throw new Error(error.message);
        if (paymentIntent) resultPI = paymentIntent;
      } else if (currentPI.status === 'requires_capture') {
        // Already authorized — just finalize.
      } else {
        throw new Error(`Unexpected payment status: ${currentPI.status}`);
      }

      if (resultPI.status !== 'requires_capture') {
        throw new Error(
          `Authorization not completed (status: ${resultPI.status}). Please try again.`,
        );
      }

      // Hand off to engine for atomic PI swap + audit log.
      await finalizeOnEngine();

      toast({
        title: 'Payment Re-authorized',
        description: `Authorization updated to $${new_amount.toFixed(
          2,
        )}. Complete the job to capture payment.`,
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[ReauthorizePaymentDialog] Re-authorization error:', error);
      toast({
        title: 'Re-authorization Failed',
        description: error?.message || 'Failed to re-authorize payment',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Customer Authorization Required
          </DialogTitle>
          <DialogDescription>
            The customer's card requires 3D&nbsp;Secure verification for the new amount.
            Click the button below to open Stripe's secure authorization window.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertDescription>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Amount:</span>
                <span className="font-medium">${original_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Difference:</span>
                <span className="font-medium text-green-600">
                  +${(new_amount - original_amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">New Total:</span>
                <span className="font-semibold text-lg">${new_amount.toFixed(2)}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <Alert>
          <DollarSign className="h-4 w-4" />
          <AlertDescription className="text-xs">
            This is an authorization only — the customer is not charged until the job is completed.
            The customer's saved card will be used; no card details need to be re-entered.
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={processing}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAuthorize}
            disabled={processing || !stripe || stripeLoading}
            className="flex-1"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authorizing...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Open Stripe Authorization
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
