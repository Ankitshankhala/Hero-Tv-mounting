
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, Shield, AlertCircle, Tv, User, Calendar, Gift, CreditCard } from 'lucide-react';
import { CalendarIcon } from 'lucide-react';
import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';
import { PaymentAuthorizationForm } from '@/components/payment/PaymentAuthorizationForm';
import { TipStep } from '@/components/booking/TipStep';
import { useBookingFlowState } from '@/hooks/booking/useBookingFlowState';
import { useCompactLayout } from '@/hooks/use-compact-layout';
import { BookingProgressSteps } from '@/components/booking/BookingProgressSteps';
import { ServiceConfigurationStep } from '@/components/booking/ServiceConfigurationStep';
import { ContactLocationStep } from '@/components/booking/ContactLocationStep';
import { ScheduleStep } from '@/components/booking/ScheduleStep';
import { BookingSuccessModal } from '@/components/booking/BookingSuccessModal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { optimizedLog } from '@/utils/performanceOptimizer';
import { StepHeader } from '@/components/booking/StepHeader';
import { StepCelebration } from '@/components/booking/StepCelebration';
import { HeroMascot } from '@/components/booking/HeroMascot';
import { disableBodyScroll, enableBodyScroll } from '@/utils/bodyScrollLock';
import { CouponSection } from '@/components/checkout/CouponSection';

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
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const { isTestingMode } = useTestingMode();
  const isCompact = useCompactLayout();
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
    nextAvailableDate,
    preferredWorkerAvailable,
    workerSpecificSlots,
    showAllWorkerSlots,
    setShowAllWorkerSlots,
    createInitialBooking,
    getTotalPrice,
    updateServiceQuantity,
    removeService,
    handleZipcodeChange,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    validateMinimumCart,
    user,
    appliedCoupon,
    setAppliedCoupon,
    subtotalBeforeDiscount
  } = useBookingFlowState(selectedServices);

  const { toast } = useToast();
  
  // State to track if booking has been created in this session
  const [hasCreatedBooking, setHasCreatedBooking] = useState(false);
  
  // Coupon handlers
  const handleCouponApplied = (code: string, discount: number, id: string) => {
    setAppliedCoupon({ code, discountAmount: discount, couponId: id });
    toast({
      title: "Coupon Applied! 🎉",
      description: `You saved $${discount.toFixed(2)}`,
    });
  };

  const handleCouponRemoved = () => {
    setAppliedCoupon(null);
    toast({
      title: "Coupon Removed",
    });
  };
  
  // Check for existing booking in session storage on component mount
  useState(() => {
    const pendingBookingId = sessionStorage.getItem('pendingBookingId');
    const pendingTimestamp = sessionStorage.getItem('pendingBookingTimestamp');
    
    if (pendingBookingId && pendingTimestamp) {
      const bookingAge = Date.now() - parseInt(pendingTimestamp);
      const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
      
      // Only restore if booking is less than 30 minutes old
      if (bookingAge < thirtyMinutes) {
        setBookingId(pendingBookingId);
        setHasCreatedBooking(true);
        optimizedLog('📂 Restored pending booking from session:', pendingBookingId);
      } else {
        // Clear expired session data
        sessionStorage.removeItem('pendingBookingId');
        sessionStorage.removeItem('pendingBookingTimestamp');
      }
    }
  });
  
  // Compute once per render
  const totalPrice = getTotalPrice();
  const isMinimumCartMet = totalPrice >= MINIMUM_BOOKING_AMOUNT;
  const amountNeeded = MINIMUM_BOOKING_AMOUNT - totalPrice;

  const handleNextStep = () => {
    if (currentStep === 1 && !isMinimumCartMet) {
      toast({
        title: "Minimum Booking Amount Required",
        description: `Your cart total is $${totalPrice}. Please add $${amountNeeded} more to reach the minimum booking amount of $${MINIMUM_BOOKING_AMOUNT}.`,
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep < 5) {
      // Show celebration for completing steps (non-blocking)
      const celebrations = {
        1: "Perfect! Your services are ready!",
        2: "Awesome! We know where to find you!",
        3: "Great choice! Time slot secured!",
        4: "So generous! Your hero will appreciate it!"
      };
      
      if (celebrations[currentStep as keyof typeof celebrations]) {
        setCelebrationMessage(celebrations[currentStep as keyof typeof celebrations]);
        setShowCelebration(true);
        
        // Auto-hide celebration after 300ms (non-blocking)
        setTimeout(() => {
          setShowCelebration(false);
        }, 300);
      }
      
      // Move to next step immediately
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
        description: `Your cart total is $${totalPrice}. Please add $${amountNeeded} more to reach the minimum booking amount of $${MINIMUM_BOOKING_AMOUNT}.`,
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
      optimizedLog('🚀 Creating booking and proceeding to payment...');
      
      // Validate minimum cart before booking creation
      if (!validateMinimumCart(services)) {
        return;
      }
      
      const createdBookingId = await createInitialBooking(
        services, 
        formData,
        appliedCoupon,
        subtotalBeforeDiscount
      );
      
      if (!createdBookingId) {
        throw new Error('No booking ID returned from booking creation');
      }
      setBookingId(createdBookingId);
      setHasCreatedBooking(true);
      
      // Show success message
      toast({
        title: "Your booking is created!",
        description: "To confirm it, please complete the payment now.",
      });
      
      // Move to tip step first
      setCurrentStep(4);
      optimizedLog('✅ Booking created successfully with ID:', createdBookingId);
    } catch (error) {
      console.error('❌ Failed to create booking:', error);
      
      // Clear any stored pending booking data on failure
      sessionStorage.removeItem('pendingBookingId');
      sessionStorage.removeItem('pendingBookingTimestamp');
      
      // Show specific error if available
      const errorMessage = error instanceof Error ? error.message : "Failed to create booking. Please try again.";
      
      toast({
        title: "Booking Creation Failed",
        description: errorMessage,
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
          totalAmount: totalPrice
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

  // Ensure a booking exists before entering payment step
  const ensureBookingBeforePayment = async () => {
    if (bookingId) {
      setCurrentStep(5);
      return;
    }
    try {
      const createdId = await createInitialBooking(
        services, 
        formData,
        appliedCoupon,
        subtotalBeforeDiscount
      );
      if (createdId) {
        setBookingId(createdId);
        setHasCreatedBooking(true);
        setCurrentStep(5);
      } else {
        toast({
          title: "Booking Not Ready",
          description: "Please go back and try creating the booking again.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Booking Creation Failed",
        description: e instanceof Error ? e.message : "Unable to create booking",
        variant: "destructive",
      });
    }
  };

  // Auto-attempt booking creation if user reaches payment without an ID
  React.useEffect(() => {
    if (currentStep === 5 && !bookingId && !loading) {
      ensureBookingBeforePayment();
    }
  }, [currentStep, bookingId, loading]);

  // Handle body scroll lock
  React.useEffect(() => {
    if (isOpen) {
      disableBodyScroll();
    } else {
      enableBodyScroll();
    }
    
    return () => {
      enableBodyScroll();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <BookingSuccessModal
        isOpen={showSuccess}
        onClose={onClose}
        successAnimation={successAnimation}
        formData={formData}
        getTotalPrice={() => totalPrice}
        bookingId={bookingId}
      />

      {!showSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-1 sm:p-2">
          <div className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col border border-slate-700/50 backdrop-blur-xl ${isCompact ? 'max-h-[90dvh]' : 'max-h-[100dvh] sm:max-h-[98dvh]'}`}>
            {/* Enhanced Header - Sticky */}
            <div className={`sticky top-0 z-10 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white rounded-t-2xl border-b border-slate-600/50 ${isCompact ? 'px-4 py-3' : 'px-4 sm:px-8 py-4 sm:py-6'}`}>
              <button
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/10 rounded-lg transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 sm:p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                    <CalendarIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold mb-1 bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                      Hero TV Mounting
                    </h2>
                    <p className="text-slate-300 text-xs sm:text-sm">Step {currentStep} of 5</p>
                  </div>
                </div>
                {!isCompact && (
                  <HeroMascot message="Let's get started!" className="hidden sm:flex" />
                )}
              </div>
            </div>

            {/* Progress Steps */}
            <div className={`${isCompact ? 'px-4 pt-3' : 'px-4 sm:px-6 pt-6'}`}>
              <BookingProgressSteps 
                currentStep={currentStep} 
                isCompact={isCompact}
                defaultCollapsed={isCompact}
              />
            </div>

            {/* Scrollable Content Area */}
            <div className={`flex-1 min-h-0 overflow-y-auto space-y-6 pb-24 ${isCompact ? 'p-4' : 'p-4 sm:p-6'}`}>
              {/* Step 1: Service Configuration */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <ServiceConfigurationStep
                    services={services}
                    updateServiceQuantity={updateServiceQuantity}
                    removeService={removeService}
                    getTotalPrice={() => totalPrice}
                  />
                  
                  {!isMinimumCartMet && services.length > 0 && (
                    <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-orange-400" />
                        <span className="font-medium text-orange-300">Minimum Booking Amount Required</span>
                      </div>
                      <p className="text-orange-200">
                         Your cart total is ${totalPrice}. Please add ${amountNeeded} more to reach the minimum booking amount of ${MINIMUM_BOOKING_AMOUNT}.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Contact & Location */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <ContactLocationStep
                    formData={formData}
                    setFormData={setFormData}
                    handleZipcodeChange={handleZipcodeChange}
                  />
                  
                  {/* Coupon Section - Show after email and zipcode are entered */}
                  {formData.customerEmail && formData.zipcode && (
                    <div className="animate-fade-in">
                      <CouponSection
                        cartTotal={subtotalBeforeDiscount}
                        customerEmail={formData.customerEmail}
                        userId={user?.id}
                        zipcode={formData.zipcode}
                        city={formData.city || ''}
                        serviceIds={services.map(s => s.id)}
                        onCouponApplied={handleCouponApplied}
                        onCouponRemoved={handleCouponRemoved}
                        appliedCoupon={appliedCoupon || undefined}
                      />
                    </div>
                  )}
                </div>
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
                  nextAvailableDate={nextAvailableDate}
                  preferredWorkerAvailable={preferredWorkerAvailable}
                  workerSpecificSlots={workerSpecificSlots}
                  showAllWorkerSlots={showAllWorkerSlots}
                  setShowAllWorkerSlots={setShowAllWorkerSlots}
                  hideActionButton={true}
                />
              )}

              {/* Step 4: Tip */}
              {currentStep === 4 && (
                <TipStep
                  formData={formData}
                  setFormData={setFormData}
                  serviceTotal={totalPrice}
                />
              )}

              {/* Step 5: Payment Authorization */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  {/* Price Summary */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-3">
                    <h4 className="text-lg font-semibold text-white mb-4">Order Summary</h4>
                    
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal:</span>
                      <span>${subtotalBeforeDiscount.toFixed(2)}</span>
                    </div>
                    
                    {appliedCoupon && (
                      <div className="flex justify-between text-green-400 font-medium">
                        <span>Coupon ({appliedCoupon.code}):</span>
                        <span>-${appliedCoupon.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {formData.tipAmount > 0 && (
                      <div className="flex justify-between text-slate-300">
                        <span>Tip:</span>
                        <span>${formData.tipAmount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="border-t border-slate-600 pt-3 flex justify-between text-xl font-bold text-white">
                      <span>Total:</span>
                      <span>${(getTotalPrice() + (formData.tipAmount || 0)).toFixed(2)}</span>
                    </div>
                  </div>

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

                  {isMinimumCartMet && bookingId ? (
                    <PaymentAuthorizationForm
                      amount={getTotalPrice() + formData.tipAmount}
                      bookingId={bookingId}
                      customerEmail={formData.customerEmail || user?.email || ''}
                      customerName={formData.customerName}
                      onAuthorizationSuccess={handlePaymentAuthorizationSuccess}
                      onAuthorizationFailure={handlePaymentAuthorizationFailure}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                      <p className="text-slate-300">
                        {!bookingId ? "Creating your booking..." : "Preparing payment form..."}
                      </p>
                      {!bookingId && (
                        <button
                          onClick={() => setCurrentStep(3)}
                          className="mt-4 text-blue-400 hover:text-blue-300 underline"
                        >
                          Go back to schedule
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
            
            {/* Sticky Footer Navigation */}
            <div className={`sticky bottom-0 z-10 bg-gradient-to-r from-slate-800/95 to-slate-700/95 backdrop-blur-sm border-t border-slate-600/50 rounded-b-2xl pb-safe ${isCompact ? 'px-4 py-3' : 'px-4 sm:px-6 py-4'}`}>
              <div className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={currentStep === 1 || loading}
                  className="bg-slate-600/50 border-slate-500 text-white hover:bg-slate-500"
                >
                  Back
                </Button>
                
                <div className="flex space-x-3">
                {currentStep === 3 && (
                  <>
                    <div className="flex flex-col items-end space-y-1 mr-4">
                      {appliedCoupon && (
                        <>
                          <div className="text-sm text-slate-300">
                            Subtotal: <span className="line-through">${subtotalBeforeDiscount.toFixed(2)}</span>
                          </div>
                          <div className="text-sm text-green-400 font-medium">
                            Discount ({appliedCoupon.code}): -${appliedCoupon.discountAmount.toFixed(2)}
                          </div>
                        </>
                      )}
                      <div className="text-lg font-bold text-white">
                        Total: ${getTotalPrice().toFixed(2)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={handleScheduleToPayment}
                      disabled={!isStep3Valid || !isMinimumCartMet || loading}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8"
                    >
                      {loading ? 'Creating Booking...' : 'Continue to Tip & Payment'}
                    </Button>
                  </>
                )}
                  
                  {currentStep === 4 && (
                    <Button
                      type="button"
                      onClick={() => ensureBookingBeforePayment()}
                      disabled={!isMinimumCartMet || loading}
                      className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8"
                    >
                      {loading ? 'Preparing...' : 'Continue to Payment'}
                    </Button>
                  )}
                  
                  {currentStep < 3 && (
                    <Button
                      type="button"
                      onClick={handleNextStep}
                      disabled={
                        (currentStep === 1 && (!isStep1Valid || !isMinimumCartMet)) ||
                        (currentStep === 2 && !isStep2Valid) ||
                        loading
                      }
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8"
                    >
                      Next Step
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step celebration overlay */}
      <StepCelebration
        isVisible={showCelebration}
        message={celebrationMessage}
        onComplete={() => setShowCelebration(false)}
      />
    </>
  );
};

export default EnhancedInlineBookingFlow;
