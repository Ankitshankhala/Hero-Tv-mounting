import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Phone, Mail, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { initiatePhoneCall } from '@/utils/phoneUtils';

interface PaymentRecoveryAlertProps {
  paymentIntentId: string;
  customerEmail?: string;
  amount: number;
  onContactSupport?: () => void;
}

export const PaymentRecoveryAlert = ({
  paymentIntentId,
  customerEmail,
  amount,
  onContactSupport
}: PaymentRecoveryAlertProps) => {
  const { toast } = useToast();

  const copyPaymentId = () => {
    navigator.clipboard.writeText(paymentIntentId);
    toast({
      title: "Payment ID Copied",
      description: "Payment ID has been copied to your clipboard",
    });
  };

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      // Default behavior - could open a support form or redirect
      window.open('mailto:support@herotvmounting.com?subject=Booking Creation Failed&body=' + 
        encodeURIComponent(`Payment authorized but booking creation failed.\n\nPayment ID: ${paymentIntentId}\nCustomer Email: ${customerEmail}\nAmount: $${amount.toFixed(2)}\n\nPlease help create my booking.`), 
        '_blank'
      );
    }
  };

  return (
    <Alert variant="destructive" className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="space-y-4">
        <div>
          <p className="font-semibold text-orange-800">
            Payment Authorized Successfully
          </p>
          <p className="text-orange-700">
            Your payment of <strong>${amount.toFixed(2)}</strong> has been authorized, 
            but we encountered an issue creating your booking. Don't worry - your card 
            has not been charged yet.
          </p>
        </div>

        <div className="bg-white p-3 rounded border border-orange-200">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Your Payment Reference:
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono flex-1">
              {paymentIntentId}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={copyPaymentId}
              className="h-8 w-8 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-orange-700">
            <strong>What happens next:</strong>
          </p>
          <ul className="text-sm text-orange-700 space-y-1 ml-4">
            <li>• We will manually create your booking within 1 business hour</li>
            <li>• You'll receive a confirmation email once your booking is set up</li>
            <li>• Your card will only be charged after service completion</li>
            <li>• If you need immediate assistance, contact our support team</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleContactSupport}
            className="flex items-center gap-2"
            size="sm"
          >
            <Mail className="h-4 w-4" />
            Contact Support
          </Button>
          <Button
            variant="outline"
            onClick={() => initiatePhoneCall('+1-555-0123')}
            className="flex items-center gap-2"
            size="sm"
          >
            <Phone className="h-4 w-4" />
            Call Support
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};