
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink, Copy, CheckCircle, Loader2 } from 'lucide-react';
import { useStripePayment } from '@/hooks/useStripePayment';
import { useToast } from '@/hooks/use-toast';

interface OnlinePaymentSectionProps {
  job: any;
  amount: string;
  onPaymentSuccess: () => void;
}

const OnlinePaymentSection = ({ job, amount, onPaymentSuccess }: OnlinePaymentSectionProps) => {
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const { createPaymentLink, processing } = useStripePayment();
  const { toast } = useToast();

  const handleGeneratePaymentLink = async () => {
    try {
      const customerEmail = job.customer?.email || job.guest_customer_info?.email;
      const amountInDollars = parseFloat(amount);
      
      console.log(`🔧 OnlinePaymentSection: Sending amount in dollars: $${amountInDollars}`);
      const result = await createPaymentLink({
        bookingId: job.id,
        amount: amountInDollars, // Send in dollars, edge function will convert to cents
        description: `Payment for Booking #${job.id.slice(0, 8)}`,
        customerEmail
      });

      if (result.success && result.paymentUrl) {
        setPaymentLink(result.paymentUrl);
        // Open payment link in new tab
        window.open(result.paymentUrl, '_blank');
        
        toast({
          title: "Payment Link Generated",
          description: "Payment link opened in new tab and ready to copy",
        });
        
        // Call success callback after link generation
        onPaymentSuccess();
      }
    } catch (error) {
      console.error('Failed to generate payment link:', error);
    }
  };

  const handleCopyLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      toast({
        title: "Link Copied",
        description: "Payment link copied to clipboard",
      });
    }
  };

  const customerInfo = job.customer || job.guest_customer_info;

  return (
    <Card className="bg-slate-800 border-slate-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <CreditCard className="h-5 w-5" />
          <span>Online Payment</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment Amount Display */}
        <div className="bg-slate-700 p-4 rounded-lg">
          <div className="flex justify-between items-center text-white">
            <span>Payment Amount:</span>
            <span className="text-xl font-bold">${amount}</span>
          </div>
        </div>

        {/* Customer Information */}
        {customerInfo && (
          <div className="bg-slate-700 p-3 rounded-lg">
            <h4 className="text-white font-medium mb-2">Customer Information</h4>
            <div className="text-slate-300 text-sm space-y-1">
              <p>Name: {customerInfo.name}</p>
              <p>Email: {customerInfo.email}</p>
              {customerInfo.phone && <p>Phone: {customerInfo.phone}</p>}
            </div>
          </div>
        )}

        {/* Payment Link Generation */}
        {!paymentLink ? (
          <Button
            onClick={handleGeneratePaymentLink}
            disabled={processing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Payment Link...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Generate Stripe Payment Link
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Payment link generated successfully!</span>
            </div>
            
            <div className="bg-slate-700 p-3 rounded-lg">
              <p className="text-slate-300 text-xs mb-2">Payment Link:</p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={paymentLink}
                  readOnly
                  className="flex-1 bg-slate-600 text-white px-2 py-1 rounded text-xs"
                />
                <Button
                  onClick={handleCopyLink}
                  size="sm"
                  variant="outline"
                  className="border-slate-500 text-slate-300 hover:bg-slate-600"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="text-slate-400 text-xs">
              <p>• Payment link opened in new tab</p>
              <p>• Customer will be redirected to Stripe for secure payment</p>
              <p>• Share this link with customer if needed</p>
            </div>
          </div>
        )}

        <div className="text-slate-400 text-xs bg-slate-700 p-3 rounded-lg">
          <p className="font-medium mb-1">How it works:</p>
          <ul className="space-y-1">
            <li>• Generates secure Stripe payment link</li>
            <li>• Customer pays using credit/debit card</li>
            <li>• Payment processed through Stripe gateway</li>
            <li>• Booking status updated automatically</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default OnlinePaymentSection;
