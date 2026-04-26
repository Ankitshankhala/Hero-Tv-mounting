import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, AlertTriangle, DollarSign } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
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

export const ReauthorizePaymentDialog = ({
  isOpen,
  onClose,
  booking_id,
  original_amount,
  new_amount,
  client_secret,
  old_payment_intent,
  new_payment_intent,
  onSuccess
}: ReauthorizePaymentDialogProps) => {
  const [processing, setProcessing] = useState(false);
  const [cardElement, setCardElement] = useState<any>(null);
  const [stripe, setStripe] = useState<any>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen && client_secret) {
      initializeStripe();
    }
  }, [isOpen, client_secret]);

  const initializeStripe = async () => {
    const stripeInstance = await loadStripe(STRIPE_PUBLISHABLE_KEY);
    if (!stripeInstance) {
      toast({
        title: "Stripe Error",
        description: "Failed to initialize payment system",
        variant: "destructive"
      });
      return;
    }

    setStripe(stripeInstance);

    const elements = stripeInstance.elements({
      clientSecret: client_secret,
    });

    const cardElementInstance = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#424770',
          '::placeholder': {
            color: '#aab7c4',
          },
        },
      },
    });

    cardElementInstance.mount('#card-element-reauth');
    setCardElement(cardElementInstance);
  };

  const handleConfirmPayment = async () => {
    if (!stripe || !cardElement) {
      toast({
        title: "Payment System Error",
        description: "Payment system not ready. Please try again.",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      // 1) Confirm the new PI client-side (handles 3DS popup if required).
      const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent.status !== 'requires_capture') {
        throw new Error(`Authorization failed (status: ${paymentIntent.status})`);
      }

      // 2) Hand off to payment-engine for the atomic swap. The engine:
      //    - bumps payment_version
      //    - swaps bookings.payment_intent_id from old → new
      //    - updates authorized_amount
      //    - cancels the old PI on Stripe
      //    - writes the authorization transaction + audit log
      // The frontend must NEVER write payment_intent_id directly.
      const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke(
        'payment-engine',
        {
          body: {
            action: 'finalize-reauthorization',
            booking_id,
            old_payment_intent_id: old_payment_intent,
            new_payment_intent_id: new_payment_intent,
            new_amount,
          },
        }
      );

      if (finalizeError || !finalizeData?.success) {
        const msg = finalizeData?.error || finalizeError?.message || 'Failed to finalize re-authorization';
        throw new Error(msg);
      }

      toast({
        title: "Payment Re-authorized",
        description: `Authorization updated to $${new_amount.toFixed(2)}. Complete the job to capture payment.`,
      });

      onSuccess?.();
      onClose();

    } catch (error: any) {
      console.error('[ReauthorizePaymentDialog] Re-authorization error:', error);
      toast({
        title: "Re-authorization Failed",
        description: error.message || 'Failed to re-authorize payment',
        variant: "destructive"
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
            Payment Re-authorization Required
          </DialogTitle>
          <DialogDescription>
            Your card doesn't support authorization updates. Please re-enter your card details.
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
                <span className="text-muted-foreground">Added Services:</span>
                <span className="font-medium text-green-600">+${(new_amount - original_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">New Total:</span>
                <span className="font-semibold text-lg">${new_amount.toFixed(2)}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Card Details
            </label>
            <div 
              id="card-element-reauth" 
              className="border rounded-md p-3 bg-white"
            />
          </div>

          <Alert>
            <DollarSign className="h-4 w-4" />
            <AlertDescription className="text-xs">
              You will not be charged until the work is completed. This is just an authorization.
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
              onClick={handleConfirmPayment}
              disabled={processing || !stripe || !cardElement}
              className="flex-1"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {processing ? 'Processing...' : `Authorize $${new_amount.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
