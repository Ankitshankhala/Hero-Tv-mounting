
import React from 'react';
import { FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DollarSign } from 'lucide-react';

interface PaymentAmountInputProps {
  amount: string;
  onAmountChange: (value: string) => void;
}

const PaymentAmountInput = ({ amount, onAmountChange }: PaymentAmountInputProps) => {
  return (
    <FormItem>
      <FormLabel>Payment Amount</FormLabel>
      <FormControl>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="pl-10"
            placeholder="0.00"
            required
          />
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
};

export default PaymentAmountInput;
