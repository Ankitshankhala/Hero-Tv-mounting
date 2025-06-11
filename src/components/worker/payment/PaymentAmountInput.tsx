
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DollarSign } from 'lucide-react';

interface PaymentAmountInputProps {
  amount: string;
  onAmountChange: (value: string) => void;
}

const PaymentAmountInput = ({ amount, onAmountChange }: PaymentAmountInputProps) => {
  return (
    <div>
      <Label htmlFor="amount">Payment Amount</Label>
      <div className="relative mt-1">
        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          id="amount"
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          className="pl-10"
          placeholder="0.00"
          required
        />
      </div>
    </div>
  );
};

export default PaymentAmountInput;
