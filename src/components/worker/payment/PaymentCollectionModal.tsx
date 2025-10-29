
import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { X } from 'lucide-react';
import PaymentJobSummary from './PaymentJobSummary';
import PaymentMethodSelector from './PaymentMethodSelector';
import PaymentAmountInput from './PaymentAmountInput';
import PaymentNotesInput from './PaymentNotesInput';
import { InlineStripePaymentForm } from './InlineStripePaymentForm';
import { usePaymentProcessing } from './usePaymentProcessing';
import SavedPaymentMethodCard from './SavedPaymentMethodCard';
import { useSavedPaymentMethods } from '@/hooks/useSavedPaymentMethods';

interface PaymentCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onPaymentCollected: () => void;
}

interface PaymentFormData {
  paymentMethod: 'cash' | 'online' | 'saved';
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

  const { paymentMethod, loading: loadingPaymentMethod, chargeSavedMethod } = useSavedPaymentMethods(job?.customer_email);

  if (!isOpen) return null;

  const hasSavedPaymentMethod = paymentMethod && paymentMethod.stripe_default_payment_method_id;

  const handleSubmit = async (data: PaymentFormData) => {
    if (data.paymentMethod === 'saved') {
      await handleChargeSavedMethod();
    } else {
      await processPayment(data.paymentMethod, data.amount, data.notes);
    }
  };

  const handleCashPayment = async (data: PaymentFormData) => {
    await processPayment('cash', data.amount, data.notes);
  };

  const handleOnlinePaymentSuccess = () => {
    onPaymentCollected();
    onClose();
  };

  const handleChargeSavedMethod = async () => {
    const amount = parseFloat(methods.watch('amount'));
    const notes = methods.watch('notes');
    
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    const result = await chargeSavedMethod(job.id, amount, notes);
    if (result.success) {
      onPaymentCollected();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Collect Payment</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <PaymentJobSummary job={job} />
          
          {/* Payment Method Tabs */}
          <div className="mt-6">
            <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg">
              {hasSavedPaymentMethod && (
                <button
                  type="button"
                  onClick={() => methods.setValue('paymentMethod', 'saved' as any)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    methods.watch('paymentMethod') === 'saved'
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Saved Card
                </button>
              )}
              <button
                type="button"
                onClick={() => methods.setValue('paymentMethod', 'cash')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  methods.watch('paymentMethod') === 'cash'
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cash Payment
              </button>
              <button
                type="button"
                onClick={() => methods.setValue('paymentMethod', 'online')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  methods.watch('paymentMethod') === 'online'
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                New Card
              </button>
            </div>
          </div>

          {/* Payment Content */}
          <div className="mt-6">
            {methods.watch('paymentMethod') === 'saved' && hasSavedPaymentMethod ? (
              <div className="space-y-4">
                <FormProvider {...methods}>
                  <form className="space-y-4">
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
                  </form>
                </FormProvider>

                <SavedPaymentMethodCard
                  last4={paymentMethod.last4}
                  brand={paymentMethod.brand}
                  expMonth={paymentMethod.exp_month}
                  expYear={paymentMethod.exp_year}
                  amount={methods.watch('amount')}
                  onCharge={handleChargeSavedMethod}
                  isProcessing={loadingPaymentMethod}
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
              </div>
            ) : methods.watch('paymentMethod') === 'cash' ? (
              <FormProvider {...methods}>
                <form onSubmit={methods.handleSubmit(handleCashPayment)} className="space-y-4">
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

                  <div className="bg-amber-900/20 border border-amber-700 p-3 rounded-lg">
                    <p className="text-amber-200 text-sm">
                      Cash payment will be recorded immediately. Make sure you have collected the payment from the customer.
                    </p>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button
                      type="submit"
                      disabled={isProcessing}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isProcessing ? 'Processing...' : `Record $${methods.watch('amount') || '0.00'} Cash Payment`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isProcessing}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </FormProvider>
            ) : (
              <div>
                <InlineStripePaymentForm
                  job={job}
                  amount={methods.watch('amount')}
                  onPaymentSuccess={handleOnlinePaymentSuccess}
                />
                <div className="flex justify-end mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCollectionModal;
