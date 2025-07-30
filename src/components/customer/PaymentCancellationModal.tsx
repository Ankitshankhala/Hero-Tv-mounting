import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { usePaymentCancellation } from '@/hooks/usePaymentCancellation';
import { AlertTriangle } from 'lucide-react';

interface PaymentCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentIntentId: string;
  amount: number;
  paymentStatus: 'authorized' | 'captured';
  onCancellationSuccess: () => void;
}

export const PaymentCancellationModal = ({
  isOpen,
  onClose,
  paymentIntentId,
  amount,
  paymentStatus,
  onCancellationSuccess
}: PaymentCancellationModalProps) => {
  const [reason, setReason] = useState('');
  const { cancelPayment, refundPayment, loading } = usePaymentCancellation();

  const handleCancel = async () => {
    try {
      let result;
      
      if (paymentStatus === 'authorized') {
        result = await cancelPayment(paymentIntentId, reason || 'customer_request');
      } else {
        result = await refundPayment(paymentIntentId, undefined, reason || 'customer_request');
      }

      if (result.success) {
        onCancellationSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Cancellation error:', error);
    }
  };

  const isAuthorized = paymentStatus === 'authorized';
  const actionText = isAuthorized ? 'Cancel Authorization' : 'Request Refund';
  const description = isAuthorized 
    ? 'This will cancel the payment authorization. No charges will be made to your card.'
    : 'This will process a full refund to your original payment method.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle>{actionText}</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-medium">${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-medium capitalize">{paymentStatus}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Please let us know why you're canceling..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Keep Booking
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? 'Processing...' : actionText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};