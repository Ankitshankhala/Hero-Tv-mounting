
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, DollarSign, CreditCard, Banknote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (paymentMethod === 'online') {
        // Process online payment
        const { data, error } = await supabase.functions.invoke('process-onsite-payment', {
          body: {
            chargeId: `charge_${Date.now()}`,
            customerId: job.customer_id,
            amount: Math.round(parseFloat(amount) * 100), // Convert to cents
            description: `Payment for Job #${job.id.slice(0, 8)} - ${job.services?.map(s => s.name).join(', ')}`
          }
        });

        if (error) {
          throw new Error(error.message || 'Online payment failed');
        }

        console.log('Online payment processed:', data);
      }

      // Record the payment transaction - using 'success' instead of 'completed'
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          booking_id: job.id,
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          status: 'success',
          processed_at: new Date().toISOString()
        });

      if (transactionError) {
        throw new Error('Failed to record transaction');
      }

      // Update the booking to reduce pending payment amount
      const remainingAmount = Math.max(0, (job.pending_payment_amount || 0) - parseFloat(amount));
      
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          pending_payment_amount: remainingAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) {
        throw new Error('Failed to update booking payment status');
      }

      toast({
        title: "Payment Collected",
        description: `Successfully collected $${amount} via ${paymentMethod}`,
      });

      onPaymentCollected();
      onClose();

    } catch (error: any) {
      console.error('Payment collection error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
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
          {/* Job Summary */}
          <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Job Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1 text-sm">
                <div>Job ID: {job.id.slice(0, 8)}</div>
                <div>Customer: {job.customer?.name}</div>
                <div>Outstanding Amount: ${job.pending_payment_amount}</div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <div>
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(value: 'cash' | 'online') => setPaymentMethod(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center space-x-2">
                    <Banknote className="h-4 w-4" />
                    <span>Cash Payment</span>
                  </div>
                </SelectItem>
                <SelectItem value="online">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-4 w-4" />
                    <span>Online Payment</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Payment Amount</Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this payment..."
              className="mt-1"
              rows={3}
            />
          </div>

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
