
import React from 'react';
import { BookingProgressSteps } from '@/components/booking/BookingProgressSteps';
import { BookingFlowHeader } from '@/components/booking/BookingFlowHeader';
import { BookingFlowSteps } from '@/components/booking/BookingFlowSteps';
import { BookingFlowNavigation } from '@/components/booking/BookingFlowNavigation';
import { BookingSuccessModal } from '@/components/booking/BookingSuccessModal';
import { useBookingFlowState } from '@/hooks/booking/useBookingFlowState';
import { useToast } from '@/hooks/use-toast';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: Record<string, any>;
}

interface EnhancedInlineBookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
  selectedServices?: ServiceItem[];
}

export const EnhancedInlineBookingFlow = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  selectedServices = [] 
}: EnhancedInlineBookingFlowProps) => {
  const {
    currentStep,
    setCurrentStep,
    services,
    formData,
    setFormData,
    availableSlots,
    blockedSlots,
    workerCount,
    loading,
    bookingId,
    showSuccess,
    setShowSuccess,
    successAnimation,
    setSuccessAnimation,
    timeSlots,
    handleBookingSubmit,
    getTotalPrice,
    updateServiceQuantity,
    removeService,
    handleZipcodeChange,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    user
  } = useBookingFlowState(selectedServices);

  const { toast } = useToast();

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePaymentSuccess = () => {
    setShowSuccess(true);
    
    toast({
      title: "Payment Successful! 🎉",
      description: "Your booking has been confirmed. We'll contact you shortly!",
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      onClose();
      onSubmit?.({
        bookingId,
        services,
        formData,
        totalAmount: getTotalPrice()
      });
    }, 5000);
  };

  const handlePaymentFailure = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <BookingSuccessModal
        isOpen={showSuccess}
        onClose={onClose}
        successAnimation={successAnimation}
        formData={formData}
        getTotalPrice={getTotalPrice}
        bookingId={bookingId}
      />

      {!showSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto border border-slate-700/50 backdrop-blur-xl">
            <BookingFlowHeader currentStep={currentStep} onClose={onClose} />

            {/* Progress Steps moved to content area */}
            <div className="px-4 sm:px-6 pt-6">
              <BookingProgressSteps currentStep={currentStep} />
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              <BookingFlowSteps
                currentStep={currentStep}
                services={services}
                formData={formData}
                setFormData={setFormData}
                timeSlots={timeSlots}
                blockedSlots={blockedSlots}
                workerCount={workerCount}
                loading={loading}
                bookingId={bookingId}
                user={user}
                updateServiceQuantity={updateServiceQuantity}
                removeService={removeService}
                getTotalPrice={getTotalPrice}
                handleZipcodeChange={handleZipcodeChange}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentFailure={handlePaymentFailure}
              />

              <BookingFlowNavigation
                currentStep={currentStep}
                loading={loading}
                isStep1Valid={isStep1Valid}
                isStep2Valid={isStep2Valid}
                isStep3Valid={isStep3Valid}
                onPrevStep={handlePrevStep}
                onNextStep={handleNextStep}
                onBookingSubmit={handleBookingSubmit}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
