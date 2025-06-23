
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

  // Return combined state with bookingOperations taking precedence for overlapping properties
  return {
    // Form state properties
    ...formState,
    // Worker availability properties  
    ...workerAvailability,
    // Override with bookingOperations properties (these take precedence)
    currentStep: bookingOperations.currentStep,
    setCurrentStep: bookingOperations.setCurrentStep,
    loading: bookingOperations.loading,
    setLoading: bookingOperations.setLoading,
    bookingId: bookingOperations.bookingId,
    setBookingId: bookingOperations.setBookingId,
    showSuccess: bookingOperations.showSuccess,
    setShowSuccess: bookingOperations.setShowSuccess,
    successAnimation: bookingOperations.successAnimation,
    setSuccessAnimation: bookingOperations.setSuccessAnimation,
    handleBookingSubmit: bookingOperations.handleBookingSubmit,
    user,
  };
};
