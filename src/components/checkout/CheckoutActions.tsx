
import React from 'react';
import { Button } from '@/components/ui/button';

interface CheckoutActionsProps {
  isProcessing: boolean;
  zipcodeValid: boolean;
  selectedDate: Date | undefined;
  formData: {
    time: string;
  };
  total: number;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const CheckoutActions = ({
  isProcessing,
  zipcodeValid,
  selectedDate,
  formData,
  total,
  onSubmit,
  onClose
}: CheckoutActionsProps) => {
  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t-2 border-gray-200">
      <Button
        type="submit"
        disabled={isProcessing || !zipcodeValid || !selectedDate || !formData.time}
        onClick={onSubmit}
        className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-700 hover:via-blue-700 hover:to-purple-700 text-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:transform-none"
      >
        {isProcessing ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Processing...</span>
          </div>
        ) : (
          `Confirm Booking - $${total.toFixed(2)}`
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={handleClose}
        className="px-8 py-3 text-lg font-semibold border-2 border-gray-300 hover:border-gray-400 rounded-xl transition-colors h-14"
        disabled={isProcessing}
      >
        Cancel
      </Button>
    </div>
  );
};
