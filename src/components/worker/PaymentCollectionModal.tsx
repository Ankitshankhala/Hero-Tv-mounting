
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X } from 'lucide-react';
import PaymentJobSummary from './payment/PaymentJobSummary';
import PaymentMethodSelector from './payment/PaymentMethodSelector';
import PaymentAmountInput from './payment/PaymentAmountInput';
import PaymentNotesInput from './payment/PaymentNotesInput';
import OnlinePaymentSection from './payment/OnlinePaymentSection';
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
  const [activeTab, setActiveTab] = useState('cash');
  const form = useForm<PaymentFormData>({
    defaultValues: {
      paymentMethod: 'cash',
      amount: job?.pending_payment_amount?.toString() || job?.total_price?.toString() || '',
      notes: ''
    }
  });

  const { isProcessing, processPayment } = usePaymentProcessing({
    job,
    onPaymentCollected,
    onClose
  });

  if (!isOpen) return null;

  const handleCashPayment = async (data: PaymentFormData) => {
    await processPayment('cash', data.amount, data.notes);
  };

  const amount = form.watch('amount');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Collect Payment</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <PaymentJobSummary job={job} />
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-2 bg-slate-700">
              <TabsTrigger value="cash" className="text-white data-[state=active]:bg-slate-600">
                Cash Payment
              </TabsTrigger>
              <TabsTrigger value="online" className="text-white data-[state=active]:bg-slate-600">
                Online Payment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cash" className="mt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCashPayment)} className="space-y-4">
                  <PaymentAmountInput 
                    amount={amount}
                    onAmountChange={(value) => form.setValue('amount', value)}
                  />

                  <PaymentNotesInput 
                    notes={form.watch('notes')}
                    onNotesChange={(value) => form.setValue('notes', value)}
                  />

                  <div className="flex space-x-3 pt-4">
                    <Button
                      type="submit"
                      disabled={isProcessing}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isProcessing ? 'Processing...' : `Collect $${amount || '0.00'} Cash`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isProcessing}
                      className="border-slate-600 text-white"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="online" className="mt-6">
              <OnlinePaymentSection
                job={job}
                amount={amount}
                onPaymentSuccess={onPaymentCollected}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default PaymentCollectionModal;
