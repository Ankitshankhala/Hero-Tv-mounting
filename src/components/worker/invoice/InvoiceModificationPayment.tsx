import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStripePayment } from '@/hooks/useStripePayment';
import { Loader2, CreditCard, ExternalLink } from 'lucide-react';

interface InvoiceModificationPaymentProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  pendingAmount: number;
  onPaymentComplete: () => void;
}

export const InvoiceModificationPayment = ({
  isOpen,
  onClose,
  job,
  pendingAmount,
  onPaymentComplete
}: InvoiceModificationPaymentProps) => {
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'existing' | 'new'>('existing');
  const { toast } = useToast();
  const { createPaymentLink } = useStripePayment();

  const handleExistingPaymentMethod = async () => {
    setProcessing(true);
    try {
      console.log('Attempting to charge existing payment method for booking:', job.id);
      
      // Try to process payment with existing payment method
      const { data, error } = await supabase.functions.invoke('process-invoice-modification-payment', {
        body: {
          bookingId: job.id,
          paymentMethodId: job.stripe_payment_method_id
        }
      });

      if (error) {
        console.error('Payment processing error:', error);
        throw new Error(error.message || 'Failed to process payment');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Payment processing failed');
      }

      toast({
        title: "Payment Successful",
        description: `Successfully charged $${pendingAmount.toFixed(2)} for additional services`,
      });

      onPaymentComplete();
      onClose();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : 'Failed to process payment with existing method',
        variant: "destructive",
      });
      
      // Fall back to new payment method
      setPaymentMethod('new');
    } finally {
      setProcessing(false);
    }
  };

  const handleNewPaymentMethod = async () => {
    setProcessing(true);
    try {
      console.log('Creating payment link for additional services:', job.id);
      
      // Get customer email from job
      const customerEmail = job.customer?.email || job.guest_customer_info?.email;
      
      if (!customerEmail) {
        throw new Error('Customer email not found');
      }

      const result = await createPaymentLink({
        bookingId: job.id,
        amount: pendingAmount,
        description: `Additional services for booking ${job.id.slice(0, 8)}`,
        customerEmail
      });

      if (result.success && result.paymentUrl) {
        // Open payment link in new tab
        window.open(result.paymentUrl, '_blank');
        
        toast({
          title: "Payment Link Created",
          description: "Payment link opened in new tab. Please complete the payment process.",
        });

        // Close the payment modal but keep the modification modal open
        onClose();
      } else {
        throw new Error(result.error || 'Failed to create payment link');
      }
    } catch (error) {
      console.error('Error creating payment link:', error);
      toast({
        title: "Payment Link Failed",
        description: error instanceof Error ? error.message : 'Failed to create payment link',
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const hasExistingPaymentMethod = job.stripe_payment_method_id && job.stripe_customer_id;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <CreditCard className="mr-2 h-5 w-5" />
            Charge Additional Services
          </DialogTitle>
        </DialogHeader>

        <Card className="bg-slate-700 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white text-lg">
              Payment Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-white">
              <p className="mb-4">
                Additional services have been added to this booking.
              </p>
              <div className="bg-slate-600 p-3 rounded-lg mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Amount to charge:</span>
                  <span className="text-xl font-bold text-green-400">
                    ${pendingAmount.toFixed(2)}
                  </span>
                </div>
              </div>
              
              {hasExistingPaymentMethod ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">
                    Choose how to collect payment:
                  </p>
                  
                  <div className="space-y-2">
                    <Button
                      onClick={handleExistingPaymentMethod}
                      disabled={processing}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {processing && paymentMethod === 'existing' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Charge Existing Card
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={handleNewPaymentMethod}
                      disabled={processing}
                      className="w-full border-border text-foreground hover:bg-accent"
                    >
                      {processing && paymentMethod === 'new' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Link...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Send New Payment Link
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">
                    No payment method on file. A payment link will be created for the customer.
                  </p>
                  
                  <Button
                    onClick={handleNewPaymentMethod}
                    disabled={processing}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Link...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Create Payment Link
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={processing}
            className="border-border text-foreground hover:bg-accent"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
