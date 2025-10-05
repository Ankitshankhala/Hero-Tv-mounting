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
      // Confirm the new payment intent
      const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent.status !== 'requires_capture') {
        throw new Error('Payment authorization failed');
      }

      // Cancel the old payment intent
      try {
        await supabase.functions.invoke('cancel-payment-intent', {
          body: {
            payment_intent_id: old_payment_intent,
            reason: 'Replaced with new payment intent for service additions'
          }
        });
      } catch (cancelError) {
        console.error('Failed to cancel old payment intent:', cancelError);
        // Don't fail the whole operation
      }

      // Update booking with new payment intent
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_intent_id: new_payment_intent,
          pending_payment_amount: new_amount
        })
        .eq('id', booking_id);

      if (updateError) {
        throw updateError;
      }

      // Create authorization transaction for new payment intent
      await supabase
        .from('transactions')
        .insert({
          booking_id,
          amount: new_amount,
          status: 'authorized',
          payment_intent_id: new_payment_intent,
          transaction_type: 'authorization',
          payment_method: 'card'
        });

      toast({
        title: "Payment Re-authorized",
        description: `Successfully authorized $${new_amount.toFixed(2)}`,
      });

      onSuccess?.();
      onClose();

    } catch (error: any) {
      console.error('Re-authorization error:', error);
      toast({
        title: "Payment Failed",
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
