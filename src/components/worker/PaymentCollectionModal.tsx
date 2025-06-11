
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { X } from 'lucide-react';
import PaymentJobSummary from './payment/PaymentJobSummary';
import PaymentMethodSelector from './payment/PaymentMethodSelector';
import PaymentAmountInput from './payment/PaymentAmountInput';
import PaymentNotesInput from './payment/PaymentNotesInput';
import { usePaymentProcessing } from './payment/usePaymentProcessing';

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
  const form = useForm<PaymentFormData>({
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

  const paymentMethod = form.watch('paymentMethod');
  const amount = form.watch('amount');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Collect Payment</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-4">
            <PaymentJobSummary job={job} />
            
            <PaymentMethodSelector 
              paymentMethod={paymentMethod}
              onPaymentMethodChange={(value) => form.setValue('paymentMethod', value)}
            />

            <PaymentAmountInput 
              amount={amount}
              onAmountChange={(value) => form.setValue('amount', value)}
            />

            <PaymentNotesInput 
              notes={form.watch('notes')}
              onNotesChange={(value) => form.setValue('notes', value)}
            />

            {paymentMethod === 'online' && (
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
                {isProcessing ? 'Processing...' : `Collect $${amount || '0.00'}`}
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
        </Form>
      </div>
    </div>
  );
};

export default PaymentCollectionModal;
