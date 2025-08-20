
import React, { useState, useEffect } from 'react';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useBookingOperations } from '@/hooks/booking/useBookingOperations';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { CartItem } from '@/types';
import { CheckoutHeader } from './checkout/CheckoutHeader';
import { ServiceSummary } from './checkout/ServiceSummary';
import { ContactInfoSection } from './checkout/ContactInfoSection';
import { ServiceLocationSection } from './checkout/ServiceLocationSection';
import { ScheduleSection } from './checkout/ScheduleSection';
import { SpecialInstructionsSection } from './checkout/SpecialInstructionsSection';
import { CheckoutActions } from './checkout/CheckoutActions';

interface EmbeddedCheckoutProps {
  cart: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const EmbeddedCheckout = ({ cart, total, onClose, onSuccess }: EmbeddedCheckoutProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    zipcode: '',
    date: '',
    time: '',
    specialInstructions: ''
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zipcodeValid, setZipcodeValid] = useState(false);
  const [cityState, setCityState] = useState('');
  const { toast } = useToast();
  const { createUnauthenticatedBooking } = useBookingOperations();

  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
  ];

  const validationRules = {
    name: { required: true, type: 'name' as const, minLength: 2, maxLength: 50 },
    email: { required: true, type: 'email' as const },
    phone: { required: true, type: 'phone' as const },
    address: { required: true, type: 'address' as const, minLength: 10, maxLength: 100 },
    zipcode: { required: true, type: 'zipcode' as const },
    date: { required: true },
    time: { required: true }
  };

  const { errors, touched, validateField, validateAllFields, markFieldAsTouched } = useFormValidation(validationRules);

  const fetchWorkerAvailability = async (date: Date, zipcode: string) => {
    if (!zipcode || !date) return;
    
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          scheduled_start,
          worker_bookings!inner(
            worker_id,
            users!inner(zip_code)
          )
        `)
        .eq('scheduled_date', dateStr)
        .eq('status', 'confirmed');

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      const zipcodePrefix = zipcode.substring(0, 3);
      const relevantBookings = bookings?.filter(booking => {
        const workerZipcode = booking.worker_bookings?.[0]?.users?.zip_code;
        return workerZipcode && workerZipcode.substring(0, 3) === zipcodePrefix;
      }) || [];

      const { data: workers, error: workerError } = await supabase
        .from('users')
        .select('id, zip_code')
        .eq('role', 'worker')
        .eq('is_active', true);

      if (!workerError) {
        const availableWorkers = workers?.filter(worker => 
          worker.zip_code && worker.zip_code.substring(0, 3) === zipcodePrefix
        ) || [];
        setWorkerCount(availableWorkers.length);
      }

      const blocked = relevantBookings.map(booking => 
        booking.scheduled_start.substring(0, 5)
      );

      setBlockedSlots(blocked);
      setAvailableSlots(timeSlots.filter(slot => !blocked.includes(slot)));
    } catch (error) {
      console.error('Error fetching worker availability:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate && formData.zipcode) {
      fetchWorkerAvailability(selectedDate, formData.zipcode);
    }
  }, [selectedDate, formData.zipcode]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field: string) => {
    markFieldAsTouched(field);
    validateField(field, formData[field]);
  };

  const handleZipcodeChange = (zipcode: string, cityStateData?: string) => {
    setFormData(prev => ({ ...prev, zipcode }));
    if (cityStateData) {
      setCityState(cityStateData);
      setZipcodeValid(true);
    } else {
      setCityState('');
      setZipcodeValid(zipcode.length === 5);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setFormData(prev => ({ ...prev, date: date ? format(date, 'yyyy-MM-dd') : '' }));
  };

  const handleTimeSelect = (time: string) => {
    setFormData(prev => ({ ...prev, time }));
  };

  const calculateTotalDuration = () => {
    return cart.reduce((total, item) => {
      let baseDuration = 60;
      if (item.options?.numberOfTvs && item.options.numberOfTvs > 1) {
        baseDuration += (item.options.numberOfTvs - 1) * 30;
      }
      return total + (baseDuration * item.quantity);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAllFields(formData)) {
      toast({
        title: "Validation Error",
        description: "Please correct the errors in the form",
        variant: "destructive",
      });
      return;
    }

    if (!zipcodeValid) {
      toast({
        title: "Invalid Zipcode",
        description: "Please enter a valid US zipcode",
        variant: "destructive",
      });
      return;
    }

    const selectedDateTime = new Date(`${formData.date}T${formData.time}:00`);
    const now = new Date();
    if (selectedDateTime <= now) {
      toast({
        title: "Invalid Date",
        description: "Please select a future date and time",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const bookingData = {
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        customer_zipcode: formData.zipcode,
        service_id: cart[0].id,
        scheduled_date: formData.date,
        scheduled_start: formData.time,
        location_notes: `${formData.address}\n\nServices: ${cart.map(item => `${item.name} (${item.quantity}x)`).join(', ')}\n\nSpecial Instructions: ${formData.specialInstructions}`,
        total_price: total,
        duration_minutes: calculateTotalDuration()
      };

      const result = await createUnauthenticatedBooking(bookingData);
      
      if (result.status === 'confirmed' || result.status === 'pending') {
        toast({
          title: "Payment Authorization Required",
          description: "To confirm your booking, please authorize the payment now.",
        });

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      } else {
        throw new Error(result.message);
      }

    } catch (error: any) {
      console.error('Booking error:', error);
      
      toast({
        title: "Booking Error",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl">
        <CheckoutHeader onClose={onClose} isProcessing={isProcessing} />

        <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <ServiceSummary cart={cart} total={total} />

            <ContactInfoSection
              formData={formData}
              errors={errors}
              touched={touched}
              zipcodeValid={zipcodeValid}
              cityState={cityState}
              onInputChange={handleInputChange}
              onBlur={handleBlur}
              onZipcodeChange={handleZipcodeChange}
            />

            <ServiceLocationSection
              formData={formData}
              errors={errors}
              touched={touched}
              onInputChange={handleInputChange}
              onBlur={handleBlur}
            />

            <ScheduleSection
              selectedDate={selectedDate}
              formData={formData}
              workerCount={workerCount}
              loading={loading}
              timeSlots={timeSlots}
              blockedSlots={blockedSlots}
              onDateSelect={handleDateSelect}
              onTimeSelect={handleTimeSelect}
            />

            <SpecialInstructionsSection
              formData={formData}
              onInputChange={handleInputChange}
            />

            <CheckoutActions
              isProcessing={isProcessing}
              zipcodeValid={zipcodeValid}
              selectedDate={selectedDate}
              formData={formData}
              total={total}
              onSubmit={handleSubmit}
              onClose={onClose}
            />
          </form>
        </div>
      </div>
    </div>
  );
};
