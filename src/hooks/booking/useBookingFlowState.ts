
import { useEffect, useState } from 'react';
import { useBookingFormState } from './useBookingFormState';
import { useWorkerAvailability } from './useWorkerAvailability';
import { useBookingOperations } from './useBookingOperations';
import { ServiceItem } from './types';
import { supabase } from '@/integrations/supabase/client';

export const useBookingFlowState = (selectedServices: ServiceItem[] = []) => {
  const [user, setUser] = useState<any>(null);
  const formState = useBookingFormState(selectedServices);
  const workerAvailability = useWorkerAvailability();
  const bookingOperations = useBookingOperations();

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Fetch worker availability when date/zipcode changes
  useEffect(() => {
    if (formState.formData.selectedDate && formState.formData.zipcode) {
      workerAvailability.fetchWorkerAvailability(formState.formData.selectedDate, formState.formData.zipcode);
    }
  }, [formState.formData.selectedDate, formState.formData.zipcode]);

  // Trigger success animation
  useEffect(() => {
    if (bookingOperations.showSuccess) {
      setTimeout(() => bookingOperations.setSuccessAnimation(true), 100);
    }
  }, [bookingOperations.showSuccess]);

  const handleBookingSubmit = async () => {
    const bookingId = await bookingOperations.handleBookingSubmit(formState.services, formState.formData);
    if (bookingId) {
      formState.setCurrentStep(4);
    }
  };

  // Explicitly type the return object to ensure proper boolean types
  return {
    ...formState,
    ...workerAvailability,
    // Explicitly override with bookingOperations properties to ensure correct types
    currentStep: bookingOperations.currentStep,
    setCurrentStep: bookingOperations.setCurrentStep,
    loading: bookingOperations.loading,
    setLoading: bookingOperations.setLoading,
    bookingId: bookingOperations.bookingId,
    setBookingId: bookingOperations.setBookingId,
    showSuccess: bookingOperations.showSuccess, // This is already boolean from useBookingOperations
    setShowSuccess: bookingOperations.setShowSuccess,
    successAnimation: bookingOperations.successAnimation, // This is already boolean from useBookingOperations
    setSuccessAnimation: bookingOperations.setSuccessAnimation,
    handleBookingSubmit: bookingOperations.handleBookingSubmit,
    user,
    handleBookingSubmit,
  };
};
