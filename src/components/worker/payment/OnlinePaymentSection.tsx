
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

interface OnlinePaymentSectionProps {
  job: any;
  amount: string;
  onPaymentSuccess: () => void;
}

const OnlinePaymentSection = ({ job, amount, onPaymentSuccess }: OnlinePaymentSectionProps) => {
  return (
    <Card className="bg-slate-800 border-slate-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <CreditCard className="h-5 w-5" />
          <span>Online Payment</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-8 text-slate-400">
          <p>Online payment link feature has been removed.</p>
          <p className="text-sm mt-2">Please use manual payment collection instead.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default OnlinePaymentSection;
