
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle, AlertTriangle, Clock, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentCaptureButtonProps {
  bookingId: string;
  paymentStatus: string;
  bookingStatus?: string;
  onCaptureSuccess?: () => void;
}

interface BookingDetails {
  payment_intent_id?: string;
  pending_payment_amount?: number;
}

export const PaymentCaptureButton = ({ 
  bookingId, 
  paymentStatus, 
  bookingStatus,
  onCaptureSuccess 
}: PaymentCaptureButtonProps) => {
  const [processing, setProcessing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const { toast } = useToast();

  // Fetch booking details for better diagnostics
  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('payment_intent_id, pending_payment_amount')
          .eq('id', bookingId)
          .single();

        if (error) {
          console.error('Error fetching booking details:', error);
          return;
        }

        setBookingDetails(data);
      } catch (error) {
        console.error('Error in fetchBookingDetails:', error);
      }
    };

    fetchBookingDetails();
  }, [bookingId]);

  const handleCapturePayment = async () => {
    setProcessing(true);
    setLastError(null);
    
    try {
      console.log('=== PAYMENT CAPTURE DEBUG ===');
      console.log('Booking ID:', bookingId);
      console.log('Payment Status:', paymentStatus);
      console.log('Booking Status:', bookingStatus);
      console.log('Booking Details:', bookingDetails);
      
      if (!bookingDetails?.payment_intent_id) {
        throw new Error('No payment intent ID found for this booking. Cannot capture payment.');
      }

      const captureRequest = { 
        booking_id: bookingId,
        payment_intent_id: bookingDetails.payment_intent_id
      };
      
      console.log('Capture request:', captureRequest);
      
      const { data, error } = await supabase.functions.invoke('capture-payment-intent', {
        body: captureRequest
      });

      console.log('Capture response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        const err: any = error as any;
        const errorMsg = err?.context?.error || err?.message || 'Failed to invoke capture function';
        throw new Error(errorMsg);
      }

      if (!data?.success) {
        const errorMsg = data?.error || data?.message || 'Payment capture failed';
        console.error('Capture failed:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('Payment captured successfully:', data);

      toast({
        title: "Payment Captured Successfully",
        description: `Payment of $${data.amount_captured || bookingDetails.pending_payment_amount} captured successfully.`,
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
      <div className="flex items-center gap-2">
        <Button
          onClick={handleCapturePayment}
          disabled={processing || !bookingDetails?.payment_intent_id}
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
        
        {/* Debug toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDebug(!showDebug)}
          className="h-8 w-8 p-0"
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>

      {/* Debug information */}
      {showDebug && (
        <div className="text-xs bg-muted p-2 rounded border">
          <div className="font-medium mb-1">Debug Info:</div>
          <div>Booking ID: {bookingId}</div>
          <div>Payment Status: {paymentStatus}</div>
          <div>Booking Status: {bookingStatus}</div>
          <div>Payment Intent: {bookingDetails?.payment_intent_id || 'Not found'}</div>
          <div>Amount: ${bookingDetails?.pending_payment_amount || 'Unknown'}</div>
        </div>
      )}

      {/* Warning for missing payment intent */}
      {!bookingDetails?.payment_intent_id && (
        <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Payment Intent Missing</p>
              <p>This booking does not have a payment intent ID. Payment cannot be captured.</p>
            </div>
          </div>
        </div>
      )}
      
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
