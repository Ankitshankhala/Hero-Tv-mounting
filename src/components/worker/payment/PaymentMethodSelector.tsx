
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, CreditCard } from 'lucide-react';

interface PaymentMethodSelectorProps {
  paymentMethod: 'cash' | 'online';
  onPaymentMethodChange: (value: 'cash' | 'online') => void;
}

const PaymentMethodSelector = ({ paymentMethod, onPaymentMethodChange }: PaymentMethodSelectorProps) => {
  return (
    <div>
      <Label>Payment Method</Label>
      <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
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
  );
};

export default PaymentMethodSelector;
