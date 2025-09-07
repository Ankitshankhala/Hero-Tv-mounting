
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ScheduleStep } from './ScheduleStep';
import { PaymentStep } from './PaymentStep';
import { BookingProgressSteps } from './BookingProgressSteps';
import { useBookingOperations } from '@/hooks/booking/useBookingOperations';
import { ServiceItem, FormData } from '@/hooks/booking/types';
import { disableBodyScroll, enableBodyScroll } from '@/utils/bodyScrollLock';

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
    houseNumber: '',
    apartmentName: '',
    address: '',
    city: '',
    zipcode: '',
    selectedDate: null,
    selectedTime: '',
    specialInstructions: '',
    tipAmount: 0
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
    createInitialBooking,
    confirmBookingAfterPayment,
    user
  } = useBookingOperations();

  // Calculate total price
  const totalPrice = services.reduce((sum, service) => sum + (service.price * service.quantity), 0);

  const handleScheduleNext = async (scheduleData: Partial<FormData>) => {
    const updatedFormData = { ...formData, ...scheduleData };
    setFormData(updatedFormData);
    
    try {
      // Create booking with payment_pending status
      console.log('Creating booking with payment_pending status...');
      const createdBookingId = await createInitialBooking(services, updatedFormData);
      setBookingId(createdBookingId);
      console.log('✅ Booking created successfully with ID:', createdBookingId);
      
      // Move to payment authorization step
      setCurrentStep(4);
    } catch (error) {
      console.error('❌ Failed to create booking:', error);
      // Stay on schedule step if booking creation fails
    }
  };

  // Watch for continueToPayment trigger from ScheduleStep
  React.useEffect(() => {
    if (formData.continueToPayment && currentStep === 3) {
      handleContinueToPayment();
    }
  }, [formData.continueToPayment, currentStep]);

  const handleContinueToPayment = async () => {
    try {
      console.log('🚀 Creating booking and proceeding to payment...');
      const createdBookingId = await createInitialBooking(services, formData);
      setBookingId(createdBookingId);
      
      // Reset the trigger and move to payment step
      setFormData(prev => ({ ...prev, continueToPayment: false }));
      setCurrentStep(4);
      
      console.log('✅ Booking created successfully with ID:', createdBookingId);
    } catch (error) {
      console.error('❌ Failed to create booking:', error);
      // Reset the trigger on failure
      setFormData(prev => ({ ...prev, continueToPayment: false }));
    }
  };

  const handlePaymentAuthorized = async (paymentIntentId?: string) => {
    try {
      if (bookingId && paymentIntentId) {
        console.log('🔄 Confirming booking after payment authorization...');
        // Confirm the existing booking after successful payment
        await confirmBookingAfterPayment(bookingId, paymentIntentId);
        console.log('✅ Booking confirmed after payment authorization');
      }
      
      setPaymentCompleted(true);
      setShowSuccess(true);
      setCurrentStep(5);
      
      // Trigger success animation
      setTimeout(() => {
        setSuccessAnimation(true);
      }, 100);
    } catch (error) {
      console.error('❌ Failed to confirm booking after payment:', error);
      // Handle the error appropriately
    }
  };

  // Ensure we have the necessary data for payment step
  const canProceedToPayment = totalPrice > 0 && formData.customerEmail && formData.customerName;

  // Handle body scroll lock
  React.useEffect(() => {
    disableBodyScroll();
    
    return () => {
      enableBodyScroll();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 sm:p-2">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[100dvh] sm:max-h-[98dvh] overflow-hidden flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white flex justify-between items-center p-4 sm:p-6 border-b">
          <h1 className="text-xl sm:text-2xl font-bold">Book Your Service</h1>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-24">
          <BookingProgressSteps currentStep={currentStep} />
          
          <div className="mt-8">
            {currentStep === 3 && (
              <ScheduleStep 
                formData={formData}
                setFormData={setFormData}
                timeSlots={[]}
                blockedSlots={[]}
                workerCount={0}
                loading={loading}
                nextAvailableDate={null}
              />
            )}
            
            {currentStep === 4 && canProceedToPayment && bookingId && (
              <PaymentStep 
                bookingId={bookingId}
                totalPrice={totalPrice}
                customerEmail={formData.customerEmail}
                customerName={formData.customerName}
                onPaymentAuthorized={handlePaymentAuthorized}
                onBack={() => setCurrentStep(3)}
              />
            )}

            {currentStep === 4 && (!canProceedToPayment || !bookingId) && (
              <div className="text-center py-8">
                <p className="text-red-600 mb-4">
                  {!bookingId 
                    ? "No booking found. Please create a booking before payment."
                    : "Unable to proceed to payment. Missing required information."
                  }
                </p>
                <button 
                  onClick={() => setCurrentStep(3)}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                >
                  Go Back to Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
