
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Link, Mail } from 'lucide-react';
import { useStripePayment } from '@/hooks/useStripePayment';

interface OnlinePaymentSectionProps {
  job: any;
  amount: string;
  onPaymentSuccess: () => void;
}

const OnlinePaymentSection = ({ job, amount, onPaymentSuccess }: OnlinePaymentSectionProps) => {
  const [customerEmail, setCustomerEmail] = useState(job.customer?.email || '');
  const [paymentUrl, setPaymentUrl] = useState('');
  const { createPaymentLink, processing } = useStripePayment();

  const handleCreatePaymentLink = async () => {
    const paymentAmount = parseFloat(amount);
    
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return;
    }

    const result = await createPaymentLink({
      bookingId: job.id,
      amount: paymentAmount,
      description: `Service Payment - Job #${job.id.slice(0, 8)}`,
      customerEmail: customerEmail
    });

    if (result.success && result.paymentUrl) {
      setPaymentUrl(result.paymentUrl);
    }
  };

  const handleSendToCustomer = () => {
    if (paymentUrl && customerEmail) {
      const subject = encodeURIComponent(`Payment Required - Job #${job.id.slice(0, 8)}`);
      const body = encodeURIComponent(
        `Hello ${job.customer?.name || 'Customer'},\n\n` +
        `Please complete your payment for the service we provided.\n\n` +
        `Payment Amount: $${amount}\n` +
        `Payment Link: ${paymentUrl}\n\n` +
        `Thank you for choosing our services!`
      );
      
      window.open(`mailto:${customerEmail}?subject=${subject}&body=${body}`, '_blank');
    }
  };

  const handleOpenPaymentLink = () => {
    if (paymentUrl) {
      window.open(paymentUrl, '_blank');
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Link className="h-5 w-5" />
          <span>Online Payment</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-slate-300">Customer Email</Label>
          <Input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="customer@example.com"
            className="bg-slate-700 border-slate-600 text-white"
          />
        </div>

        {!paymentUrl ? (
          <Button
            onClick={handleCreatePaymentLink}
            disabled={processing || !customerEmail || !amount}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {processing ? 'Creating...' : 'Create Payment Link'}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-slate-700 rounded-lg">
              <Label className="text-slate-300 text-sm">Payment Link Created:</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input
                  value={paymentUrl}
                  readOnly
                  className="bg-slate-600 border-slate-500 text-white text-sm"
                />
                <Button
                  onClick={() => navigator.clipboard.writeText(paymentUrl)}
                  size="sm"
                  variant="outline"
                  className="border-slate-500"
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={handleSendToCustomer}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={!customerEmail}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send to Customer
              </Button>
              <Button
                onClick={handleOpenPaymentLink}
                variant="outline"
                className="border-slate-500"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Link
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OnlinePaymentSection;
