
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
    houseNumber: '',
    apartmentName: '',
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
  const [hasServiceCoverage, setHasServiceCoverage] = useState(false);
  const [zipcodeWorkerCount, setZipcodeWorkerCount] = useState(0);
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
    houseNumber: { required: false, type: 'address' as const, minLength: 1, maxLength: 20 },
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
      
      // Use the updated database function that enforces strict ZIP code matching
      const { data: availableSlots, error } = await supabase.rpc('get_available_time_slots', {
        p_zipcode: zipcode,
        p_date: dateStr,
        p_service_duration_minutes: 60
      });

      if (error) {
        console.error('Error fetching available time slots:', error);
        setAvailableSlots([]);
        setBlockedSlots(timeSlots);
        setWorkerCount(0);
        return;
      }

      // Extract available time slots 
      const slots = availableSlots?.map(slot => {
        // Convert time format if needed
        const timeString = slot.time_slot?.toString();
        if (timeString?.includes(':')) {
          return timeString.substring(0, 5); // Get HH:MM format
        }
        return timeString;
      }).filter(Boolean) || [];

      // Calculate total unique workers for this zipcode
      const totalWorkerIds = new Set();
      availableSlots?.forEach(slot => {
        slot.worker_ids?.forEach(id => totalWorkerIds.add(id));
      });

      setWorkerCount(totalWorkerIds.size);
      setAvailableSlots(slots);
      setBlockedSlots(timeSlots.filter(slot => !slots.includes(slot)));
      
    } catch (error) {
      console.error('Error fetching worker availability:', error);
      setAvailableSlots([]);
      setBlockedSlots(timeSlots);
      setWorkerCount(0);
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

  const handleZipcodeChange = async (zipcode: string, cityStateData?: string) => {
    setFormData(prev => ({ ...prev, zipcode }));
    if (cityStateData) {
      setCityState(cityStateData);
      setZipcodeValid(true);
      
      // Check service coverage for the new zipcode
      try {
        const { getServiceCoverageInfo } = await import('@/utils/zipcodeValidation');
        const coverageData = await getServiceCoverageInfo(zipcode);
        setHasServiceCoverage(coverageData.hasServiceCoverage);
        setZipcodeWorkerCount(coverageData.workerCount);
      } catch (error) {
        console.error('Error checking service coverage:', error);
        setHasServiceCoverage(false);
        setZipcodeWorkerCount(0);
      }
    } else {
      setCityState('');
      setZipcodeValid(zipcode.length === 5);
      setHasServiceCoverage(false);
      setZipcodeWorkerCount(0);
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

    if (!hasServiceCoverage) {
      toast({
        title: "Service Not Available",
        description: "We don't currently service this area. Please contact us for alternative options.",
        variant: "destructive",
      });
      return;
    }

    if (availableSlots.length === 0) {
      toast({
        title: "No Available Time Slots",
        description: "No workers are available for your selected date. Please choose a different date.",
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
        customer_address: formData.address,
        customer_unit: formData.houseNumber,
        customer_apartment_name: formData.apartmentName,
        customer_zipcode: formData.zipcode,
        service_id: cart[0].id,
        scheduled_date: formData.date,
        scheduled_start: formData.time,
        location_notes: `${formData.address}${formData.houseNumber ? `\nUnit: ${formData.houseNumber}` : ''}${formData.apartmentName ? `\nApartment: ${formData.apartmentName}` : ''}\n\nServices: ${cart.map(item => `${item.name} (${item.quantity}x)`).join(', ')}\n\nSpecial Instructions: ${formData.specialInstructions}`,
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
              hasServiceCoverage={hasServiceCoverage}
              workerCount={zipcodeWorkerCount}
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
              hasServiceCoverage={hasServiceCoverage}
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
