
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, Shield, AlertCircle } from 'lucide-react';
import { CalendarIcon } from 'lucide-react';
import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';
import { PaymentAuthorizationForm } from '@/components/payment/PaymentAuthorizationForm';
import { useBookingFlowState } from '@/hooks/booking/useBookingFlowState';
import { BookingProgressSteps } from '@/components/booking/BookingProgressSteps';
import { ServiceConfigurationStep } from '@/components/booking/ServiceConfigurationStep';
import { ContactLocationStep } from '@/components/booking/ContactLocationStep';
import { ScheduleStep } from '@/components/booking/ScheduleStep';
import { BookingSuccessModal } from '@/components/booking/BookingSuccessModal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { optimizedLog } from '@/utils/performanceOptimizer';

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
  const { isTestingMode } = useTestingMode();
  const MINIMUM_BOOKING_AMOUNT = getEffectiveMinimumAmount(isTestingMode);
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
    setBookingId,
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
  
  // State to track if booking has been created in this session
  const [hasCreatedBooking, setHasCreatedBooking] = useState(false);
  
  const isMinimumCartMet = getTotalPrice() >= MINIMUM_BOOKING_AMOUNT;
  const amountNeeded = MINIMUM_BOOKING_AMOUNT - getTotalPrice();

  const handleNextStep = () => {
    if (currentStep === 1 && !isMinimumCartMet) {
      toast({
        title: "Minimum Booking Amount Required",
        description: `Your cart total is $${getTotalPrice()}. Please add $${amountNeeded} more to reach the minimum booking amount of $${MINIMUM_BOOKING_AMOUNT}.`,
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleScheduleToPayment = async () => {
    if (!isMinimumCartMet) {
      toast({
        title: "Minimum Booking Amount Required",
        description: `Your cart total is $${getTotalPrice()}. Please add $${amountNeeded} more to reach the minimum booking amount of $${MINIMUM_BOOKING_AMOUNT}.`,
        variant: "destructive",
      });
      return;
    }

    // Check if booking already exists
    if (bookingId && hasCreatedBooking) {
      optimizedLog('📝 Booking already exists, proceeding to payment...');
      toast({
        title: "Proceeding to Payment",
        description: "Your booking is ready. Please complete the payment authorization.",
      });
      setCurrentStep(4);
      return;
    }

    try {
      // Create booking with payment_pending status
      optimizedLog('🚀 Creating booking and proceeding to payment...');
      const createdBookingId = await handleBookingSubmit();
      
      if (createdBookingId) {
        setBookingId(createdBookingId);
        setHasCreatedBooking(true);
        
        // Show success message
        toast({
          title: "Your booking is created!",
          description: "To confirm it, please complete the payment now.",
        });
        
        // Move to payment step
        setCurrentStep(4);
        optimizedLog('✅ Booking created successfully with ID:', createdBookingId);
      }
    } catch (error) {
      console.error('❌ Failed to create booking:', error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePaymentAuthorizationSuccess = async (paymentIntentId?: string) => {
    try {
      if (bookingId && paymentIntentId) {
        // Confirm booking after successful payment
        optimizedLog('✅ Payment authorized, confirming booking...');
        
        const { data: confirmResult, error: confirmError } = await supabase.functions.invoke(
          'confirm-payment',
          {
            body: {
              payment_intent_id: paymentIntentId,
              booking_id: bookingId
            }
          }
        );

        if (confirmError || !confirmResult.success) {
          throw new Error(confirmError?.message || 'Failed to confirm booking after payment');
        }

        optimizedLog('✅ Booking confirmed after payment:', confirmResult);
        
        toast({
          title: "Payment Authorized & Booking Confirmed! 🎉",
          description: "Your booking is confirmed. Payment will be charged after service completion.",
        });
      } else {
        toast({
          title: "Payment Authorized! 🎉",
          description: "Your booking is confirmed. Payment will be charged after service completion.",
        });
      }
      
      setShowSuccess(true);

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
    } catch (error) {
      console.error('❌ Error confirming booking after payment:', error);
      toast({
        title: "Payment Authorized but Booking Confirmation Failed",
        description: "Your payment was successful but we couldn't confirm your booking. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handlePaymentAuthorizationFailure = (error: string) => {
    toast({
      title: "Payment Authorization Failed",
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
            {/* Enhanced Header */}
            <div className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white px-4 sm:px-8 py-4 sm:py-6 rounded-t-2xl border-b border-slate-600/50">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/10 rounded-lg transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 sm:p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                  <CalendarIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold mb-1">Book Your Service</h2>
                  <p className="text-slate-300 text-xs sm:text-sm">Step {currentStep} of 4</p>
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="px-4 sm:px-6 pt-6">
              <BookingProgressSteps currentStep={currentStep} />
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Step 1: Service Configuration */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <ServiceConfigurationStep
                    services={services}
                    updateServiceQuantity={updateServiceQuantity}
                    removeService={removeService}
                    getTotalPrice={getTotalPrice}
                  />
                  
                  {!isMinimumCartMet && services.length > 0 && (
                    <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-orange-400" />
                        <span className="font-medium text-orange-300">Minimum Booking Amount Required</span>
                      </div>
                      <p className="text-orange-200">
                        Your cart total is ${getTotalPrice()}. Please add ${amountNeeded} more to reach the minimum booking amount of ${MINIMUM_BOOKING_AMOUNT}.
                      </p>
                    </div>
                  )}
                </div>
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
                  hideActionButton={true}
                />
              )}

              {/* Step 4: Payment Authorization */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Payment Authorization</h3>
                    <p className="text-slate-300">Authorize payment - you'll only be charged after service completion</p>
                  </div>

                  {!isMinimumCartMet && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <span className="font-medium text-red-300">Cannot Process Payment</span>
                      </div>
                      <p className="text-red-200">
                        Your cart total is ${getTotalPrice()}. Please add ${amountNeeded} more to reach the minimum booking amount of ${MINIMUM_BOOKING_AMOUNT}.
                      </p>
                    </div>
                  )}

                  {isMinimumCartMet ? (
                    <PaymentAuthorizationForm
                      amount={getTotalPrice()}
                      bookingId={bookingId}
                      customerEmail={formData.customerEmail || user?.email}
                      customerName={formData.customerName}
                      services={services}
                      formData={formData}
                      onAuthorizationSuccess={handlePaymentAuthorizationSuccess}
                      onAuthorizationFailure={handlePaymentAuthorizationFailure}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                      <p className="text-slate-300">Preparing payment form...</p>
                    </div>
                  )}
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
                        (currentStep === 1 && (!isStep1Valid || !isMinimumCartMet)) ||
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
                      onClick={handleScheduleToPayment}
                      disabled={!isStep3Valid || !isMinimumCartMet || loading}
                      className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white border-0"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          Continue to Payment
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
