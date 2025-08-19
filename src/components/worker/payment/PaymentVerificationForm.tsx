import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, CheckCircle } from 'lucide-react';

interface PaymentVerificationFormProps {
  sessionId: string;
  amount: number;
  onPaymentSuccess: () => void;
  onPaymentFailure: (error: string) => void;
}

export const PaymentVerificationForm = ({
  sessionId,
  amount,
  onPaymentSuccess,
  onPaymentFailure
}: PaymentVerificationFormProps) => {
  const [verifying, setVerifying] = useState(false);
  const { toast } = useToast();

  const handleVerifyPayment = async () => {
    setVerifying(true);
    
    try {
      console.log('Verifying payment for session:', sessionId);
      
      // Call the verify-payment-session function
      const { data, error } = await supabase.functions.invoke('verify-payment-session', {
        body: {
          sessionId: sessionId
        }
      });

      if (error) {
        console.error('Payment verification error:', error);
        throw new Error(`Payment verification failed: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Payment verification failed');
      }

      // Check if payment was successful
      if (data.status === 'paid') {
        toast({
          title: "Payment Verified",
          description: `Payment of $${amount.toFixed(2)} has been successfully processed`,
        });
        onPaymentSuccess();
      } else {
        throw new Error(`Payment status: ${data.status}. Please complete the payment first.`);
      }

    } catch (error) {
      console.error('Error verifying payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify payment';
      
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      onPaymentFailure(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card className="bg-slate-700 border-slate-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <ExternalLink className="h-5 w-5" />
          <span>Payment Gateway Opened</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-slate-300 space-y-2">
          <p>The payment gateway has been opened in a new tab.</p>
          <p>Amount: <span className="text-emerald-400 font-bold">${amount.toFixed(2)}</span></p>
          <p className="text-sm text-slate-400">
            Please complete the payment in the new tab, then click "Verify Payment" below.
          </p>
        </div>

        <div className="flex space-x-3">
          <Button
            onClick={handleVerifyPayment}
            disabled={verifying}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {verifying ? 'Verifying...' : 'Verify Payment'}
          </Button>
        </div>

        <div className="text-xs text-slate-400 text-center">
          If the payment window closed, you can try adding services again to reopen it.
        </div>
      </CardContent>
    </Card>
  );
};