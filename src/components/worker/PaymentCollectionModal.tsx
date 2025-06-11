
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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

const PaymentCollectionModal = ({ isOpen, onClose, job, onPaymentCollected }: PaymentCollectionModalProps) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [amount, setAmount] = useState(job?.pending_payment_amount?.toString() || '');
  const [notes, setNotes] = useState('');

  const { isProcessing, processPayment } = usePaymentProcessing({
    job,
    onPaymentCollected,
    onClose
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await processPayment(paymentMethod, amount, notes);
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <PaymentJobSummary job={job} />
          
          <PaymentMethodSelector 
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
          />

          <PaymentAmountInput 
            amount={amount}
            onAmountChange={setAmount}
          />

          <PaymentNotesInput 
            notes={notes}
            onNotesChange={setNotes}
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
      </div>
    </div>
  );
};

export default PaymentCollectionModal;
