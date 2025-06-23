
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

  return {
    ...formState,
    ...workerAvailability,
    ...bookingOperations,
    user,
    handleBookingSubmit,
    // Ensure these are properly typed as booleans
    showSuccess: Boolean(bookingOperations.showSuccess),
    successAnimation: Boolean(bookingOperations.successAnimation)
  };
};
