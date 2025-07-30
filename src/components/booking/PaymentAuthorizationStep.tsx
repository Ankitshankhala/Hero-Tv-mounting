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
      <div className="text-center">
        <h2 className="text-2xl font-bold">Secure Payment Authorization</h2>
        <p className="text-muted-foreground mt-2">
          We'll authorize your payment now, but you'll only be charged when the service is completed.
        </p>
      </div>

      <PaymentAuthorizationCard
        bookingId={bookingData.id || ''}
        amount={bookingData.totalPrice}
        customerName={bookingData.customerName}
        customerEmail={bookingData.customerEmail}
        onAuthorizationSuccess={onAuthorizationSuccess}
        onCancel={onBack}
      />
    </div>
  );
};