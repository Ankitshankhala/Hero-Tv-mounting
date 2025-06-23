
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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

export const useBookingFlowState = (selectedServices: ServiceItem[] = []) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<ServiceItem[]>(selectedServices);
  const [formData, setFormData] = useState<FormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    zipcode: '',
    address: '',
    city: '',
    region: '',
    selectedDate: undefined,
    selectedTime: '',
    specialInstructions: ''
  });

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  // Update services when props change
  useEffect(() => {
    setServices(selectedServices);
  }, [selectedServices]);

  // Trigger success animation
  useEffect(() => {
    if (showSuccess) {
      setTimeout(() => setSuccessAnimation(true), 100);
    }
  }, [showSuccess]);

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
    if (formData.selectedDate && formData.zipcode) {
      fetchWorkerAvailability(formData.selectedDate, formData.zipcode);
    }
  }, [formData.selectedDate, formData.zipcode]);

  const handleBookingSubmit = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to complete your booking.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const primaryServiceId = services.length > 0 ? services[0].id : null;
      
      if (!primaryServiceId) {
        throw new Error('No services selected');
      }

      const bookingData = {
        customer_id: user.id,
        service_id: primaryServiceId,
        scheduled_date: format(formData.selectedDate!, 'yyyy-MM-dd'),
        scheduled_start: formData.selectedTime,
        location_notes: `${formData.address}, ${formData.city}\nContact: ${formData.customerName}\nPhone: ${formData.customerPhone}\nEmail: ${formData.customerEmail}\nZIP: ${formData.zipcode}\nSpecial Instructions: ${formData.specialInstructions}`,
        status: 'pending' as const,
        requires_manual_payment: true
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select()
        .single();

      if (error) throw error;

      setBookingId(data.id);
      setCurrentStep(4);
      
      toast({
        title: "Booking Created",
        description: "Your booking has been created. Please complete payment.",
      });
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTotalPrice = () => {
    return services.reduce((total, service) => total + (service.price * service.quantity), 0);
  };

  const updateServiceQuantity = (serviceId: string, change: number) => {
    setServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, quantity: Math.max(1, service.quantity + change) }
        : service
    ));
  };

  const removeService = (serviceId: string) => {
    setServices(prev => prev.filter(service => service.id !== serviceId));
  };

  const handleZipcodeChange = (zipcode: string, cityState?: string) => {
    setFormData(prev => ({ ...prev, zipcode }));
    
    if (cityState) {
      const [city, state] = cityState.split(', ');
      setFormData(prev => ({ 
        ...prev,
        city: city || prev.city,
        region: prev.region || 'downtown'
      }));
    }
  };

  const isStep1Valid = services.length > 0;
  const isStep2Valid = formData.customerName && formData.customerEmail && formData.customerPhone && formData.address && formData.zipcode;
  const isStep3Valid = formData.selectedDate && formData.selectedTime;

  return {
    currentStep,
    setCurrentStep,
    services,
    setServices,
    formData,
    setFormData,
    availableSlots,
    blockedSlots,
    workerCount,
    loading,
    setLoading,
    bookingId,
    setBookingId,
    showSuccess,
    setShowSuccess,
    paymentCompleted,
    setPaymentCompleted,
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
  };
};
