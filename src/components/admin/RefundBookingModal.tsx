import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, DollarSign, User, CreditCard } from 'lucide-react';
import { useAdminRefund } from '@/hooks/useAdminRefund';

interface RefundBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onRefundComplete?: () => void;
}

export const RefundBookingModal = ({
  isOpen,
  onClose,
  booking,
  onRefundComplete
}: RefundBookingModalProps) => {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { processRefund, loading } = useAdminRefund();

  // Calculate max refund amount from booking
  const maxRefundAmount = booking?.pending_payment_amount || 0;
  const paymentStatus = booking?.payment_status || 'pending';
  const customerName = booking?.users?.name || booking?.guest_customer_info?.name || 'Unknown';
  const customerEmail = booking?.users?.email || booking?.guest_customer_info?.email;

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setRefundType('full');
      setRefundAmount('');
      setReason('');
      setNotifyCustomer(true);
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!reason || reason.trim().length < 10) {
      newErrors.reason = 'Refund reason must be at least 10 characters';
    }

    if (refundType === 'partial') {
      const amount = parseFloat(refundAmount);
      if (!refundAmount || isNaN(amount) || amount <= 0) {
        newErrors.refundAmount = 'Please enter a valid refund amount';
      } else if (amount > maxRefundAmount) {
        newErrors.refundAmount = `Refund amount cannot exceed $${maxRefundAmount}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const result = await processRefund({
      bookingId: booking.id,
      refundAmount: refundType === 'full' ? undefined : parseFloat(refundAmount),
      reason: reason.trim(),
      notifyCustomer
    });

    if (result.success) {
      onRefundComplete?.();
      onClose();
    }
  };

  const isAuthorized = paymentStatus === 'authorized';
  const isCaptured = paymentStatus === 'completed' || paymentStatus === 'captured';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Process Refund
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Booking Information */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{customerName}</span>
            </div>
            {customerEmail && (
              <div className="text-sm text-muted-foreground">{customerEmail}</div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>
                {isAuthorized && 'Payment Authorized (Not Captured)'}
                {isCaptured && `Payment Captured: $${maxRefundAmount}`}
                {!isAuthorized && !isCaptured && 'Payment Status Unknown'}
              </span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <strong>Warning:</strong> This action cannot be undone. 
              {isAuthorized && ' The payment authorization will be cancelled.'}
              {isCaptured && ' The refund will be processed immediately to the customer\'s payment method.'}
            </div>
          </div>

          {/* Refund Type */}
          {isCaptured && (
            <div className="space-y-3">
              <Label>Refund Type</Label>
              <RadioGroup value={refundType} onValueChange={(value: 'full' | 'partial') => setRefundType(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="full" />
                  <Label htmlFor="full" className="font-normal cursor-pointer">
                    Full Refund (${maxRefundAmount})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="partial" id="partial" />
                  <Label htmlFor="partial" className="font-normal cursor-pointer">
                    Partial Refund
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Partial Refund Amount */}
          {refundType === 'partial' && isCaptured && (
            <div className="space-y-2">
              <Label htmlFor="refundAmount">
                Refund Amount (Max: ${maxRefundAmount})
              </Label>
              <Input
                id="refundAmount"
                type="number"
                step="0.01"
                min="0"
                max={maxRefundAmount}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className={errors.refundAmount ? 'border-destructive' : ''}
              />
              {errors.refundAmount && (
                <p className="text-sm text-destructive">{errors.refundAmount}</p>
              )}
            </div>
          )}

          {/* Refund Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Refund Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a detailed reason for this refund (min. 10 characters)"
              rows={4}
              className={errors.reason ? 'border-destructive' : ''}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {reason.length}/10 characters minimum
            </p>
          </div>

          {/* Notify Customer */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="notifyCustomer"
              checked={notifyCustomer}
              onCheckedChange={(checked) => setNotifyCustomer(checked as boolean)}
            />
            <Label
              htmlFor="notifyCustomer"
              className="font-normal cursor-pointer"
            >
              Send refund notification email to customer
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Processing...' : `Process ${refundType === 'full' ? 'Full' : 'Partial'} Refund`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
