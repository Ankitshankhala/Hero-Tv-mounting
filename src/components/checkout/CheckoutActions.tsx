import React from 'react';
import { Button } from '@/components/ui/button';
import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';

interface CheckoutActionsProps {
  isProcessing: boolean;
  zipcodeValid: boolean;
  hasServiceCoverage: boolean;
  selectedDate: Date | undefined;
  formData: {
    time: string;
  };
  total: number;
  appliedCoupon?: {
    code: string;
    discountAmount: number;
  } | null;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const CheckoutActions = ({
  isProcessing,
  zipcodeValid,
  hasServiceCoverage,
  selectedDate,
  formData,
  total,
  appliedCoupon,
  onSubmit,
  onClose
}: CheckoutActionsProps) => {
  const { isTestingMode } = useTestingMode();
  const minimumAmount = getEffectiveMinimumAmount(isTestingMode);
  const finalTotal = appliedCoupon ? total - appliedCoupon.discountAmount : total;
  
  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <div className="space-y-4 pt-6 border-t-2 border-gray-200">
      {/* Price Summary */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-foreground">
          <span>Subtotal:</span>
          <span className="font-semibold">${total.toFixed(2)}</span>
        </div>
        {appliedCoupon && (
          <div className="flex justify-between text-green-600 dark:text-green-400">
            <span>Discount ({appliedCoupon.code}):</span>
            <span className="font-semibold">-${appliedCoupon.discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-xl font-bold text-foreground border-t pt-2">
          <span>Total:</span>
          <span>${finalTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Minimum order warning */}
      {!isTestingMode && total < minimumAmount && (
        <p className='text-foreground'>
          Your cart total is ${total.toFixed(2)}. Please add ${(minimumAmount - total).toFixed(2)} more to reach the ${minimumAmount} minimum order amount.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          type="submit"
          disabled={isProcessing || !zipcodeValid || !hasServiceCoverage || !selectedDate || !formData.time || (!isTestingMode && total < minimumAmount)}
          onClick={onSubmit}
          className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-700 hover:via-blue-700 hover:to-purple-700 text-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:transform-none"
        >
          {isProcessing ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Processing...</span>
            </div>
          ) : (
            `Confirm Booking - $${finalTotal.toFixed(2)}`
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          className="px-8 py-3 text-lg text-black font-semibold border-2 border-gray-300 hover:border-gray-400 rounded-xl transition-colors h-14"
          disabled={isProcessing}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};