
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CreditCard, Smartphone, Banknote } from 'lucide-react';

interface PaymentMethodSelectorProps {
  selectedMethod: 'card' | 'digital_wallet' | 'cash';
  onMethodChange: (method: 'card' | 'digital_wallet' | 'cash') => void;
  allowCash?: boolean;
}

export const PaymentMethodSelector = ({ 
  selectedMethod, 
  onMethodChange, 
  allowCash = false 
}: PaymentMethodSelectorProps) => {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-4">Payment Method</h3>
        <RadioGroup value={selectedMethod} onValueChange={onMethodChange}>
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
            <RadioGroupItem value="card" id="card" />
            <Label htmlFor="card" className="flex items-center space-x-2 cursor-pointer flex-1">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium">Credit/Debit Card</div>
                <div className="text-sm text-gray-500">Secure online payment</div>
              </div>
            </Label>
          </div>
          
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
            <RadioGroupItem value="digital_wallet" id="digital_wallet" />
            <Label htmlFor="digital_wallet" className="flex items-center space-x-2 cursor-pointer flex-1">
              <Smartphone className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium">Digital Wallet</div>
                <div className="text-sm text-gray-500">Apple Pay, Google Pay</div>
              </div>
            </Label>
          </div>

          {allowCash && (
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value="cash" id="cash" />
              <Label htmlFor="cash" className="flex items-center space-x-2 cursor-pointer flex-1">
                <Banknote className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium">Cash Payment</div>
                  <div className="text-sm text-gray-500">Pay at service time</div>
                </div>
              </Label>
            </div>
          )}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};
