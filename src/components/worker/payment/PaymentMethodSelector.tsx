
import React from 'react';
import { FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, CreditCard } from 'lucide-react';

interface PaymentMethodSelectorProps {
  paymentMethod: 'cash' | 'online';
  onPaymentMethodChange: (value: 'cash' | 'online') => void;
}

const PaymentMethodSelector = ({ paymentMethod, onPaymentMethodChange }: PaymentMethodSelectorProps) => {
  return (
    <FormItem>
      <FormLabel>Payment Method</FormLabel>
      <FormControl>
        <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
          <SelectTrigger>
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
      </FormControl>
      <FormMessage />
    </FormItem>
  );
};

export default PaymentMethodSelector;
