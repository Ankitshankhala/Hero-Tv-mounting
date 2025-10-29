import React from 'react';
import { CreditCard, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SavedPaymentMethodCardProps {
  last4?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  amount: string;
  onCharge: () => void;
  isProcessing: boolean;
}

const SavedPaymentMethodCard = ({
  last4,
  brand,
  expMonth,
  expYear,
  amount,
  onCharge,
  isProcessing
}: SavedPaymentMethodCardProps) => {
  const brandDisplay = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card';

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">{brandDisplay} •••• {last4 || '****'}</p>
              {expMonth && expYear && (
                <div className="flex items-center space-x-1 text-slate-400 text-sm">
                  <Calendar className="h-3 w-3" />
                  <span>Expires {expMonth}/{expYear}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-green-900/20 border border-green-700 p-3 rounded-lg mb-4">
          <p className="text-green-200 text-sm">
            ✓ Customer's payment method is saved and ready to charge
          </p>
        </div>

        <Button
          onClick={onCharge}
          disabled={isProcessing || !amount || parseFloat(amount) <= 0}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isProcessing ? 'Processing...' : `Charge $${amount || '0.00'}`}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SavedPaymentMethodCard;
