
import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { X } from 'lucide-react';
import PaymentJobSummary from './PaymentJobSummary';
import PaymentMethodSelector from './PaymentMethodSelector';
import PaymentAmountInput from './PaymentAmountInput';
import PaymentNotesInput from './PaymentNotesInput';
import { usePaymentProcessing } from './usePaymentProcessing';

interface PaymentCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onPaymentCollected: () => void;
}

interface PaymentFormData {
  paymentMethod: 'cash' | 'online';
  amount: string;
  notes: string;
}

const PaymentCollectionModal = ({ isOpen, onClose, job, onPaymentCollected }: PaymentCollectionModalProps) => {
  const methods = useForm<PaymentFormData>({
    defaultValues: {
      paymentMethod: 'cash',
      amount: job?.pending_payment_amount?.toString() || '',
      notes: ''
    }
  });

  const { isProcessing, processPayment } = usePaymentProcessing({
    job,
    onPaymentCollected,
    onClose
  });

  if (!isOpen) return null;

  const handleSubmit = async (data: PaymentFormData) => {
    await processPayment(data.paymentMethod, data.amount, data.notes);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Collect Payment</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(handleSubmit)} className="p-6 space-y-4">
            <PaymentJobSummary job={job} />
            
            <FormField
              control={methods.control}
              name="paymentMethod"
              render={({ field }) => (
                <PaymentMethodSelector 
                  paymentMethod={field.value}
                  onPaymentMethodChange={field.onChange}
                />
              )}
            />

            <FormField
              control={methods.control}
              name="amount"
              render={({ field }) => (
                <PaymentAmountInput 
                  amount={field.value}
                  onAmountChange={field.onChange}
                />
              )}
            />

            <FormField
              control={methods.control}
              name="notes"
              render={({ field }) => (
                <PaymentNotesInput 
                  notes={field.value}
                  onNotesChange={field.onChange}
                />
              )}
            />

            {methods.watch('paymentMethod') === 'online' && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  Online payment will be processed using the customer's saved payment method.
                </p>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <Button
                type="submit"
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? 'Processing...' : `Collect $${methods.watch('amount') || '0.00'}`}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
};

export default PaymentCollectionModal;
