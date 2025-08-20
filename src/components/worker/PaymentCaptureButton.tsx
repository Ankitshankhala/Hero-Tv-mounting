
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentCaptureButtonProps {
  bookingId: string;
  paymentStatus: string;
  bookingStatus?: string;
  onCaptureSuccess?: () => void;
}

export const PaymentCaptureButton = ({ 
  bookingId, 
  paymentStatus, 
  bookingStatus,
  onCaptureSuccess 
}: PaymentCaptureButtonProps) => {
  const [processing, setProcessing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCapturePayment = async () => {
    setProcessing(true);
    setLastError(null);
    
    try {
      console.log('Starting payment capture for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('capture-payment-intent', {
        body: { booking_id: bookingId }
      });

      console.log('Capture response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to invoke capture function');
      }

      if (!data?.success) {
        const errorMsg = data?.error || 'Payment capture failed';
        console.error('Capture failed:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('Payment captured successfully:', data);

      toast({
        title: "Payment Captured Successfully",
        description: `$${data.amount_captured} ${data.currency?.toUpperCase()} captured. Job marked as completed.`,
      });

      setLastError(null);

      if (onCaptureSuccess) {
        onCaptureSuccess();
      }

    } catch (error) {
      console.error('Payment capture error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to capture payment";
      setLastError(errorMessage);
      
      toast({
        title: "Payment Capture Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  // Show completed status for captured/completed payments
  if (paymentStatus === 'captured' || paymentStatus === 'completed' || bookingStatus === 'completed') {
    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 text-success">
          <CheckCircle className="h-4 w-4" />
          <span className="font-medium">Payment Captured</span>
        </div>
        <Badge variant="secondary" className="bg-success/10 text-success">
          Job Ready for Completion
        </Badge>
      </div>
    );
  }

  // Show capture failed status
  if (paymentStatus === 'capture_failed') {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span>Capture Failed</span>
        </div>
        <Button
          onClick={handleCapturePayment}
          disabled={processing}
          size="sm"
          variant="outline"
          className="border-action-info text-action-info hover:bg-action-info hover:text-white transition-all duration-200"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          {processing ? 'Retrying...' : 'Retry Capture'}
        </Button>
      </div>
    );
  }

  // Show collect payment button for failed/cancelled payments
  if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>Payment {paymentStatus}</span>
          <Badge variant="destructive">{paymentStatus}</Badge>
        </div>
        <button
          onClick={() => {
            // This will trigger a payment collection modal
            console.log('Collect payment for booking:', bookingId);
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-md text-sm font-medium transition-colors"
        >
          <CreditCard className="h-4 w-4 mr-2 inline" />
          Collect Payment
        </button>
      </div>
    );
  }

  // Show pending status for other payment statuses
  if (paymentStatus !== 'authorized') {
    return (
      <div className="flex items-center space-x-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Payment {paymentStatus}</span>
        <Badge variant="outline">{paymentStatus}</Badge>
      </div>
    );
  }

  // Main capture button for authorized payments
  return (
    <div className="space-y-2">
      <Button
        onClick={handleCapturePayment}
        disabled={processing}
        size="sm"
        className="bg-action-success hover:bg-action-success/90 text-white border-action-success transition-all duration-200"
      >
        <CreditCard className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">
          {processing ? 'Processing Payment...' : 'Charge'}
        </span>
        <span className="sm:hidden">
          {processing ? 'Processing...' : 'Charge'}
        </span>
      </Button>
      
      {lastError && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Capture Error:</p>
              <p>{lastError}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
