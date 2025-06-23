
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ServiceStep } from './ServiceStep';
import { ContactStep } from './ContactStep';
import { ScheduleStep } from './ScheduleStep';
import { PaymentStep } from './PaymentStep';
import { SuccessStep } from './SuccessStep';
import { StepIndicator } from './StepIndicator';
import { useBookingOperations } from '@/hooks/booking/useBookingOperations';
import { ServiceItem, FormData } from '@/hooks/booking/types';

interface BookingFlowProps {
  onClose: () => void;
  initialServices?: ServiceItem[];
}

export const BookingFlow = ({ onClose, initialServices = [] }: BookingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [formData, setFormData] = useState<FormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    address: '',
    city: '',
    zipcode: '',
    selectedDate: null,
    selectedTime: '',
    specialInstructions: ''
  });

  const {
    loading,
    bookingId,
    setBookingId,
    showSuccess,
    setShowSuccess,
    paymentCompleted,
    setPaymentCompleted,
    successAnimation,
    setSuccessAnimation,
    handleBookingSubmit,
    user
  } = useBookingOperations();

  // Calculate total price
  const totalPrice = services.reduce((sum, service) => sum + (service.price * service.quantity), 0);

  const handleServiceNext = (selectedServices: ServiceItem[]) => {
    setServices(selectedServices);
    setCurrentStep(2);
  };

  const handleContactNext = (contactData: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...contactData }));
    setCurrentStep(3);
  };

  const handleScheduleNext = async (scheduleData: Partial<FormData>) => {
    const updatedFormData = { ...formData, ...scheduleData };
    setFormData(updatedFormData);

    try {
      // Create booking and get booking ID
      const newBookingId = await handleBookingSubmit(services, updatedFormData);
      if (newBookingId) {
        setBookingId(newBookingId);
        setCurrentStep(4);
      }
    } catch (error) {
      console.error('Failed to create booking:', error);
      // Stay on current step if booking creation fails
    }
  };

  const handlePaymentAuthorized = () => {
    setPaymentCompleted(true);
    setShowSuccess(true);
    setCurrentStep(5);
    
    // Trigger success animation
    setTimeout(() => {
      setSuccessAnimation(true);
    }, 100);
  };

  const handleStepClick = (step: number) => {
    // Only allow going back to previous steps
    if (step < currentStep) {
      setCurrentStep(step);
    }
  };

  // Ensure we have the necessary data for payment step
  const canProceedToPayment = bookingId && totalPrice > 0 && formData.customerEmail && formData.customerName;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h1 className="text-2xl font-bold">Book Your Service</h1>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />
          
          <div className="mt-8">
            {currentStep === 1 && (
              <ServiceStep 
                initialServices={services}
                onNext={handleServiceNext}
              />
            )}
            
            {currentStep === 2 && (
              <ContactStep 
                formData={formData}
                onNext={handleContactNext}
                onBack={() => setCurrentStep(1)}
              />
            )}
            
            {currentStep === 3 && (
              <ScheduleStep 
                formData={formData}
                onNext={handleScheduleNext}
                onBack={() => setCurrentStep(2)}
                loading={loading}
              />
            )}
            
            {currentStep === 4 && canProceedToPayment && (
              <PaymentStep 
                bookingId={bookingId}
                totalPrice={totalPrice}
                customerEmail={formData.customerEmail}
                customerName={formData.customerName}
                onPaymentAuthorized={handlePaymentAuthorized}
                onBack={() => setCurrentStep(3)}
              />
            )}

            {currentStep === 4 && !canProceedToPayment && (
              <div className="text-center py-8">
                <p className="text-red-600 mb-4">
                  Unable to proceed to payment. Missing required information.
                </p>
                <button 
                  onClick={() => setCurrentStep(3)}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                >
                  Go Back to Schedule
                </button>
              </div>
            )}
            
            {currentStep === 5 && showSuccess && (
              <SuccessStep 
                bookingId={bookingId}
                services={services}
                totalPrice={totalPrice}
                onClose={onClose}
                animation={successAnimation}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
