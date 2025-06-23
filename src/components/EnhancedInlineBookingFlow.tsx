
import React from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, Shield } from 'lucide-react';
import { CalendarIcon } from 'lucide-react';
import { SecurePaymentForm } from '@/components/payment/SecurePaymentForm';
import { useBookingFlowState } from '@/hooks/booking/useBookingFlowState';
import { BookingProgressSteps } from '@/components/booking/BookingProgressSteps';
import { ServiceConfigurationStep } from '@/components/booking/ServiceConfigurationStep';
import { ContactLocationStep } from '@/components/booking/ContactLocationStep';
import { ScheduleStep } from '@/components/booking/ScheduleStep';
import { BookingSuccessModal } from '@/components/booking/BookingSuccessModal';
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
            {/* Enhanced Header with Progress */}
            <div className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white px-4 sm:px-8 py-4 sm:py-6 rounded-t-2xl border-b border-slate-600/50">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/10 rounded-lg transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center space-x-3 mb-4 sm:mb-0">
                  <div className="p-2 sm:p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                    <CalendarIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold mb-1">Book Your Service</h2>
                    <p className="text-slate-300 text-xs sm:text-sm">Step {currentStep} of 4</p>
                  </div>
                </div>
                
                <BookingProgressSteps currentStep={currentStep} />
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
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
                    onPaymentSuccess={handlePaymentSuccess}
                    onPaymentFailure={handlePaymentFailure}
                    collectOnly={true}
                  />
                </div>
              )}

              {/* Enhanced Navigation Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-600/50 bg-slate-800/30 rounded-xl p-4 space-y-4 sm:space-y-0 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-slate-300">Secure & encrypted</span>
                </div>

                <div className="flex space-x-3 w-full sm:w-auto">
                  {currentStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={handlePrevStep}
                      className="flex-1 sm:flex-none bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 hover:border-slate-500"
                      disabled={loading}
                    >
                      Back
                    </Button>
                  )}
                  
                  {currentStep < 3 && (
                    <Button
                      onClick={handleNextStep}
                      disabled={
                        (currentStep === 1 && !isStep1Valid) ||
                        (currentStep === 2 && !isStep2Valid) ||
                        loading
                      }
                      className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white border-0"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Loading...
                        </>
                      ) : (
                        <>
                          Next Step
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}

                  {currentStep === 3 && (
                    <Button
                      onClick={handleBookingSubmit}
                      disabled={!isStep3Valid || loading}
                      className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white border-0"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          Create Booking
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
