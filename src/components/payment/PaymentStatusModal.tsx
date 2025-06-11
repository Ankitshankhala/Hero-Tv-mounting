
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { usePaymentProcessing } from '@/hooks/usePaymentProcessing';

interface PaymentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  onPaymentSuccess?: () => void;
  onPaymentFailure?: () => void;
}

export const PaymentStatusModal = ({ 
  isOpen, 
  onClose, 
  sessionId,
  onPaymentSuccess,
  onPaymentFailure 
}: PaymentStatusModalProps) => {
  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | 'error'>('checking');
  const [message, setMessage] = useState('');
  const { verifyPayment } = usePaymentProcessing();

  useEffect(() => {
    if (isOpen && sessionId) {
      checkPaymentStatus();
    }
  }, [isOpen, sessionId]);

  const checkPaymentStatus = async () => {
    if (!sessionId) return;

    try {
      setStatus('checking');
      setMessage('Verifying your payment...');

      const result = await verifyPayment(sessionId);

      if (result.success) {
        setStatus('success');
        setMessage('Payment successful! Your booking has been confirmed.');
        onPaymentSuccess?.();
      } else {
        setStatus('failed');
        setMessage(result.error || 'Payment verification failed');
        onPaymentFailure?.();
      }
    } catch (error) {
      setStatus('error');
      setMessage('Unable to verify payment status. Please contact support.');
      console.error('Payment status check failed:', error);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-600" />;
      case 'failed':
        return <XCircle className="h-12 w-12 text-red-600" />;
      case 'error':
        return <AlertTriangle className="h-12 w-12 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'checking':
        return 'Processing Payment';
      case 'success':
        return 'Payment Successful';
      case 'failed':
        return 'Payment Failed';
      case 'error':
        return 'Verification Error';
      default:
        return 'Payment Status';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getStatusTitle()}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-6">
          {getStatusIcon()}
          <p className="text-center text-gray-600">{message}</p>
          
          {status === 'failed' && (
            <Button 
              onClick={checkPaymentStatus}
              variant="outline"
              className="mt-4"
            >
              Try Again
            </Button>
          )}
          
          {(status === 'success' || status === 'failed' || status === 'error') && (
            <Button onClick={onClose} className="mt-4">
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
