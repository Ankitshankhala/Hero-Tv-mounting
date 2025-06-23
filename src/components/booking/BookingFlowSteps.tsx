
import React from 'react';
import { ServiceConfigurationStep } from './ServiceConfigurationStep';
import { ContactLocationStep } from './ContactLocationStep';
import { ScheduleStep } from './ScheduleStep';
import { SecurePaymentForm } from '@/components/payment/SecurePaymentForm';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: Record<string, any>;
}

interface FormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  zipcode: string;
  address: string;
  city: string;
  region: string;
  selectedDate: Date | undefined;
  selectedTime: string;
  specialInstructions: string;
}

interface BookingFlowStepsProps {
  currentStep: number;
  services: ServiceItem[];
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  timeSlots: string[];
  blockedSlots: string[];
  workerCount: number;
  loading: boolean;
  bookingId?: string;
  user?: any;
  updateServiceQuantity: (serviceId: string, change: number) => void;
  removeService: (serviceId: string) => void;
  getTotalPrice: () => number;
  handleZipcodeChange: (zipcode: string, cityState?: string) => void;
  onPaymentSuccess: () => void;
  onPaymentFailure: (error: string) => void;
}

export const BookingFlowSteps = ({
  currentStep,
  services,
  formData,
  setFormData,
  timeSlots,
  blockedSlots,
  workerCount,
  loading,
  bookingId,
  user,
  updateServiceQuantity,
  removeService,
  getTotalPrice,
  handleZipcodeChange,
  onPaymentSuccess,
  onPaymentFailure
}: BookingFlowStepsProps) => {
  return (
    <>
      {/* Step 1: Service Configuration */}
      {currentStep === 1 && (
        <ServiceConfigurationStep
          services={services}
          updateServiceQuantity={updateServiceQuantity}
          removeService={removeService}
          getTotalPrice={getTotalPrice}
        />
      )}

      {/* Step 2: Contact & Location */}
      {currentStep === 2 && (
        <ContactLocationStep
          formData={formData}
          setFormData={setFormData}
          handleZipcodeChange={handleZipcodeChange}
        />
      )}

      {/* Step 3: Schedule */}
      {currentStep === 3 && (
        <ScheduleStep
          formData={formData}
          setFormData={setFormData}
          timeSlots={timeSlots}
          blockedSlots={blockedSlots}
          workerCount={workerCount}
          loading={loading}
        />
      )}

      {/* Step 4: Payment */}
      {currentStep === 4 && bookingId && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-2">Secure Payment</h3>
            <p className="text-slate-300">Complete your booking with secure payment</p>
          </div>

          <SecurePaymentForm
            amount={getTotalPrice()}
            bookingId={bookingId}
            customerId={user?.id}
            customerEmail={formData.customerEmail || user?.email}
            customerName={formData.customerName}
            onPaymentSuccess={onPaymentSuccess}
            onPaymentFailure={onPaymentFailure}
            collectOnly={true}
          />
        </div>
      )}
    </>
  );
};
