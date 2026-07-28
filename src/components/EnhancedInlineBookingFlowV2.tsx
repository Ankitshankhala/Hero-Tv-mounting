import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, AlertCircle, CalendarIcon } from 'lucide-react';
import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';
import { useBookingFormState } from '@/hooks/booking/useBookingFormState';
import { useZctaWorkerAvailability } from '@/hooks/booking/useZctaWorkerAvailability';
import { useCompactLayout } from '@/hooks/use-compact-layout';
import { useAuth } from '@/hooks/useAuth';
import { BookingProgressSteps } from '@/components/booking/BookingProgressSteps';
import { ServiceConfigurationStep } from '@/components/booking/ServiceConfigurationStep';
import { ContactLocationStep } from '@/components/booking/ContactLocationStep';
import { ScheduleStep } from '@/components/booking/ScheduleStep';
import { StepCelebration } from '@/components/booking/StepCelebration';
import { HeroMascot } from '@/components/booking/HeroMascot';
import { CouponSection } from '@/components/checkout/CouponSection';
import { SHOW_COUPON_INPUT } from '@/config/features';
import { useToast } from '@/hooks/use-toast';
import { disableBodyScroll, enableBodyScroll } from '@/utils/bodyScrollLock';

const TipStep = lazy(() =>
  import('@/components/booking/TipStep').then((m) => ({ default: m.TipStep })),
);
const BookingSuccessModal = lazy(() =>
  import('@/components/booking/BookingSuccessModal').then((m) => ({
    default: m.BookingSuccessModal,
  })),
);
const CartPaymentAuthorizationForm = lazy(() =>
  import('@/components/payment/CartPaymentAuthorizationForm').then((m) => ({
    default: m.CartPaymentAuthorizationForm,
  })),
);

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: Record<string, any>;
}

interface EnhancedInlineBookingFlowV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
  selectedServices?: ServiceItem[];
}

/**
 * V2: payment-first checkout.
 *
 * Reuses every existing step component (ServiceConfigurationStep,
 * ContactLocationStep, CouponSection, ScheduleStep, TipStep,
 * BookingProgressSteps, StepCelebration, HeroMascot, BookingSuccessModal)
 * plus the `useBookingFormState` + `useZctaWorkerAvailability` hooks.
 *
 * Key difference vs V1: NO booking row is created before payment.
 * Step 5 collects the card, then `create-authorized-booking` authorizes the
 * card and creates the booking atomically server-side.
 *
 * V2 is gated behind `app_settings.payment_first_enabled`. When the flag is
 * off, `src/pages/Index.tsx` renders the V1 component instead — V2 is not
 * mounted, so this file has no effect on the live flow.
 */
export const EnhancedInlineBookingFlowV2 = ({
  isOpen,
  onClose,
  onSubmit,
  selectedServices = [],
}: EnhancedInlineBookingFlowV2Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isTestingMode } = useTestingMode();
  const isCompact = useCompactLayout();
  const MINIMUM_BOOKING_AMOUNT = getEffectiveMinimumAmount(isTestingMode);

  const {
    currentStep,
    setCurrentStep,
    services,
    formData,
    setFormData,
    updateServiceQuantity,
    removeService,
    getTotalPrice,
    handleZipcodeChange,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    appliedCoupon,
    setAppliedCoupon,
    subtotalBeforeDiscount,
  } = useBookingFormState(selectedServices);

  const {
    blockedSlots,
    workerCount,
    loading: availabilityLoading,
    timeSlots,
    nextAvailableDate,
    preferredWorkerAvailable,
    workerSpecificSlots,
    showAllWorkerSlots,
    setShowAllWorkerSlots,
    fetchWorkerAvailability,
  } = useZctaWorkerAvailability();

  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);
  const [completedBookingId, setCompletedBookingId] = useState<string | null>(null);

  // Fetch availability when date/zip/preferred worker changes
  useEffect(() => {
    if (formData.selectedDate && formData.zipcode) {
      fetchWorkerAvailability(
        formData.selectedDate,
        formData.zipcode,
        formData.preferredWorkerId,
      );
    }
  }, [formData.selectedDate, formData.zipcode, formData.preferredWorkerId]);

  useEffect(() => {
    if (isOpen) disableBodyScroll();
    else enableBodyScroll();
    return () => enableBodyScroll();
  }, [isOpen]);

  useEffect(() => {
    if (showSuccess) {
      const t = setTimeout(() => setSuccessAnimation(true), 100);
      return () => clearTimeout(t);
    }
  }, [showSuccess]);

  const totalPrice = getTotalPrice();
  const isMinimumCartMet = totalPrice >= MINIMUM_BOOKING_AMOUNT;
  const amountNeeded = Math.max(0, MINIMUM_BOOKING_AMOUNT - totalPrice);
  const totalWithTip = totalPrice + (formData.tipAmount || 0);

  const handleCouponApplied = (code: string, discount: number, id: string) => {
    setAppliedCoupon({ code, discountAmount: discount, couponId: id });
    toast({ title: 'Coupon Applied! 🎉', description: `You saved $${discount.toFixed(2)}` });
  };
  const handleCouponRemoved = () => setAppliedCoupon(null);

  const showStepCelebration = (msg: string) => {
    setCelebrationMessage(msg);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 300);
  };

  const handleNext = () => {
    if (currentStep === 1 && !isMinimumCartMet) {
      toast({
        title: 'Minimum Booking Amount Required',
        description: `Add $${amountNeeded} more to reach $${MINIMUM_BOOKING_AMOUNT}.`,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep < 5) {
      const celebrations: Record<number, string> = {
        1: 'Perfect! Your services are ready!',
        2: 'Awesome! We know where to find you!',
        3: 'Great choice! Time slot secured!',
        4: 'So generous! Your hero will appreciate it!',
      };
      if (celebrations[currentStep]) showStepCelebration(celebrations[currentStep]);
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Build the cart payload for create-authorized-booking. The edge function
  // re-prices services server-side, so the `price` here is informational.
  const buildAuthorizePayload = () => {
    const primaryServiceId = services[0]?.id;
    const dateStr = formData.selectedDate
      ? new Date(
          formData.selectedDate.getTime() -
            formData.selectedDate.getTimezoneOffset() * 60000,
        )
          .toISOString()
          .split('T')[0]
      : '';
    return {
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        quantity: s.quantity,
        options: s.options || {},
      })),
      service_id: primaryServiceId,
      scheduled_date: dateStr,
      scheduled_start: formData.selectedTime,
      guest_customer_info: {
        email: formData.customerEmail,
        name: formData.customerName,
        phone: formData.customerPhone,
        zipcode: formData.zipcode,
      },
      tip_amount: Number(formData.tipAmount) || 0,
      coupon_id: appliedCoupon?.couponId ?? null,
      coupon_code: appliedCoupon?.code ?? null,
      coupon_discount: appliedCoupon?.discountAmount ?? 0,
      subtotal_before_discount: subtotalBeforeDiscount,
      customer_id: user?.id ?? null,
      location_notes: [
        formData.houseNumber && `House #${formData.houseNumber}`,
        formData.apartmentName && `Apt: ${formData.apartmentName}`,
        formData.address,
        formData.specialInstructions && `Notes: ${formData.specialInstructions}`,
      ]
        .filter(Boolean)
        .join(' | '),
      preferred_worker_id: formData.preferredWorkerId ?? null,
    };
  };

  const handleAuthorizeSuccess = (result: {
    booking_id: string;
    payment_intent_id: string;
  }) => {
    setCompletedBookingId(result.booking_id);
    setShowSuccess(true);
    setTimeout(() => {
      onClose();
      onSubmit?.({
        bookingId: result.booking_id,
        services,
        formData,
        totalAmount: totalWithTip,
      });
    }, 5000);
  };

  const handleAuthorizeFailure = (error: string) => {
    toast({
      title: 'Payment Authorization Failed',
      description: error,
      variant: 'destructive',
    });
  };

  const handleNoWorkers = () => {
    toast({
      title: 'No technicians available',
      description: 'Please pick a different date or ZIP code — no charge was made.',
      variant: 'destructive',
    });
  };

  const canProceedToPayment = useMemo(
    () => isStep3Valid && isStep2Valid && isMinimumCartMet && !!services.length,
    [isStep3Valid, isStep2Valid, isMinimumCartMet, services.length],
  );

  if (!isOpen) return null;

  return (
    <>
      <Suspense fallback={null}>
        <BookingSuccessModal
          isOpen={showSuccess}
          onClose={onClose}
          successAnimation={successAnimation}
          formData={formData}
          getTotalPrice={() => totalPrice}
          bookingId={completedBookingId}
        />
      </Suspense>

      {!showSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-1 sm:p-2">
          <div
            className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col border border-slate-700/50 backdrop-blur-xl ${
              isCompact ? 'max-h-[90dvh]' : 'max-h-[100dvh] sm:max-h-[98dvh]'
            }`}
          >
            {/* Header */}
            <div
              className={`sticky top-0 z-10 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white rounded-t-2xl border-b border-slate-600/50 ${
                isCompact ? 'px-4 py-3' : 'px-4 sm:px-8 py-4 sm:py-6'
              }`}
            >
              <button
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/10 rounded-lg transition-all duration-200"
                aria-label="Close"
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
                    <p className="text-slate-300 text-xs sm:text-sm">
                      Step {currentStep} of 5
                    </p>
                  </div>
                </div>
                {!isCompact && (
                  <HeroMascot message="Let's get started!" className="hidden sm:flex" />
                )}
              </div>
            </div>

            {/* Progress */}
            <div className={`${isCompact ? 'px-4 pt-3' : 'px-4 sm:px-6 pt-6'}`}>
              <BookingProgressSteps
                currentStep={currentStep}
                isCompact={isCompact}
                defaultCollapsed={isCompact}
              />
            </div>

            {/* Content */}
            <div
              className={`flex-1 min-h-0 overflow-y-auto space-y-6 pb-24 ${
                isCompact ? 'p-4' : 'p-4 sm:p-6'
              }`}
            >
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
                        <span className="font-medium text-orange-300">
                          Minimum Booking Amount Required
                        </span>
                      </div>
                      <p className="text-orange-200">
                        Your cart total is ${totalPrice}. Please add ${amountNeeded} more to
                        reach the minimum booking amount of ${MINIMUM_BOOKING_AMOUNT}.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <ContactLocationStep
                    formData={formData}
                    setFormData={setFormData}
                    handleZipcodeChange={handleZipcodeChange}
                  />
                  {SHOW_COUPON_INPUT && formData.customerEmail && formData.zipcode && (
                    <div className="animate-fade-in">
                      <CouponSection
                        cartTotal={subtotalBeforeDiscount}
                        customerEmail={formData.customerEmail}
                        userId={user?.id}
                        zipcode={formData.zipcode}
                        city={formData.city || ''}
                        serviceIds={services.map((s) => s.id)}
                        onCouponApplied={handleCouponApplied}
                        onCouponRemoved={handleCouponRemoved}
                        appliedCoupon={appliedCoupon || undefined}
                      />
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <ScheduleStep
                  formData={formData}
                  setFormData={setFormData}
                  timeSlots={timeSlots}
                  blockedSlots={blockedSlots}
                  workerCount={workerCount}
                  loading={availabilityLoading}
                  nextAvailableDate={nextAvailableDate}
                  preferredWorkerAvailable={preferredWorkerAvailable}
                  workerSpecificSlots={workerSpecificSlots}
                  showAllWorkerSlots={showAllWorkerSlots}
                  setShowAllWorkerSlots={setShowAllWorkerSlots}
                  hideActionButton={true}
                />
              )}

              {currentStep === 4 && (
                <Suspense fallback={null}>
                  <TipStep
                    formData={formData}
                    setFormData={setFormData}
                    serviceTotal={totalPrice}
                  />
                </Suspense>
              )}

              {currentStep === 5 && (
                <div className="space-y-6">
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
                      <span>${totalWithTip.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Payment Authorization
                    </h3>
                    <p className="text-slate-300">
                      Authorize payment — your booking is created only after the card is
                      approved.
                    </p>
                  </div>

                  {!canProceedToPayment ? (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <span className="font-medium text-red-300">
                          Cannot Process Payment
                        </span>
                      </div>
                      <p className="text-red-200">
                        Please go back and complete all previous steps.
                      </p>
                    </div>
                  ) : (
                    <Suspense fallback={null}>
                      <CartPaymentAuthorizationForm
                        amount={totalWithTip}
                        customerEmail={formData.customerEmail || user?.email || ''}
                        customerName={formData.customerName}
                        buildPayload={buildAuthorizePayload}
                        onSuccess={handleAuthorizeSuccess}
                        onFailure={handleAuthorizeFailure}
                        onNoWorkers={handleNoWorkers}
                      />
                    </Suspense>
                  )}
                </div>
              )}
            </div>

            {/* Footer nav */}
            <div
              className={`sticky bottom-0 z-10 bg-gradient-to-r from-slate-800/95 to-slate-700/95 backdrop-blur-sm border-t border-slate-600/50 rounded-b-2xl pb-safe ${
                isCompact ? 'px-4 py-3' : 'px-4 sm:px-6 py-4'
              }`}
            >
              <div className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentStep === 1}
                  className="bg-slate-600/50 border-slate-500 text-white hover:bg-slate-500"
                >
                  Back
                </Button>

                <div className="flex space-x-3 items-center">
                  {(currentStep === 3 || currentStep === 4) && (
                    <div className="flex flex-col items-end space-y-1 mr-4">
                      {appliedCoupon && (
                        <>
                          <div className="text-sm text-slate-300">
                            Subtotal:{' '}
                            <span className="line-through">
                              ${subtotalBeforeDiscount.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-sm text-green-400 font-medium">
                            Discount ({appliedCoupon.code}): -$
                            {appliedCoupon.discountAmount.toFixed(2)}
                          </div>
                        </>
                      )}
                      <div className="text-lg font-bold text-white">
                        Total: ${totalWithTip.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {currentStep < 5 && (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={
                        (currentStep === 1 && (!isStep1Valid || !isMinimumCartMet)) ||
                        (currentStep === 2 && !isStep2Valid) ||
                        (currentStep === 3 && !isStep3Valid)
                      }
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8"
                    >
                      {currentStep === 4 ? 'Continue to Payment' : 'Next Step'}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <StepCelebration
        isVisible={showCelebration}
        message={celebrationMessage}
        onComplete={() => setShowCelebration(false)}
      />
    </>
  );
};

export default EnhancedInlineBookingFlowV2;
