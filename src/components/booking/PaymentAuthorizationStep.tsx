import React from 'react';
import { PaymentAuthorizationCard } from '@/components/customer/PaymentAuthorizationCard';

interface PaymentAuthorizationStepProps {
  bookingData: {
    id?: string;
    totalPrice: number;
    customerName: string;
    customerEmail: string;
  };
  onAuthorizationSuccess: (paymentIntentId: string) => void;
  onBack: () => void;
}

export const PaymentAuthorizationStep = ({
  bookingData,
  onAuthorizationSuccess,
  onBack
}: PaymentAuthorizationStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Secure Payment Authorization</h2>
        <p className="text-muted-foreground">
          We'll authorize your payment now to secure your booking. You'll only be charged when your service is completed.
        </p>
        
        {/* Payment Process Timeline */}
        <div className="bg-muted/30 rounded-lg p-4 max-w-2xl mx-auto">
          <h3 className="font-semibold text-sm mb-3">How Payment Works:</h3>
          <div className="flex items-center justify-between text-xs">
            <div className="flex flex-col items-center space-y-1">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">1</div>
              <span className="text-center">Authorize Payment</span>
              <span className="text-muted-foreground text-center">Secures your booking</span>
            </div>
            <div className="h-px bg-border flex-1 mx-2"></div>
            <div className="flex flex-col items-center space-y-1">
              <div className="w-8 h-8 rounded-full border-2 border-muted-foreground text-muted-foreground flex items-center justify-center font-semibold">2</div>
              <span className="text-center">Service Completed</span>
              <span className="text-muted-foreground text-center">Worker finishes job</span>
            </div>
            <div className="h-px bg-border flex-1 mx-2"></div>
            <div className="flex flex-col items-center space-y-1">
              <div className="w-8 h-8 rounded-full border-2 border-muted-foreground text-muted-foreground flex items-center justify-center font-semibold">3</div>
              <span className="text-center">Payment Charged</span>
              <span className="text-muted-foreground text-center">Final payment collected</span>
            </div>
          </div>
        </div>
      </div>

      {bookingData.id ? (
        <PaymentAuthorizationCard
          bookingId={bookingData.id}
          amount={bookingData.totalPrice}
          customerName={bookingData.customerName}
          customerEmail={bookingData.customerEmail}
          onAuthorizationSuccess={onAuthorizationSuccess}
          onCancel={onBack}
        />
      ) : (
        <div className="text-center p-6">
          <p className="text-muted-foreground">Creating your booking...</p>
        </div>
      )}
    </div>
  );
};