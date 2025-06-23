
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

  // Create wrapper function for handleBookingSubmit
  const handleBookingSubmit = async () => {
    const bookingId = await bookingOperations.handleBookingSubmit(formState.services, formState.formData);
    if (bookingId) {
      bookingOperations.setCurrentStep(4);
    }
  };

  // Destructure formState excluding ALL conflicting properties
  const {
    currentStep: _formCurrentStep,
    setCurrentStep: _formSetCurrentStep,
    showSuccess: _formShowSuccess,
    successAnimation: _formSuccessAnimation,
    ...cleanFormState
  } = formState;

  // Destructure workerAvailability excluding conflicting properties  
  const {
    loading: _workerLoading,
    ...cleanWorkerAvailability
  } = workerAvailability;

  // Return merged state with bookingOperations spread last to take precedence
  return {
    ...cleanFormState,
    ...cleanWorkerAvailability,
    ...bookingOperations,
    handleBookingSubmit, // Use our wrapper function
    user,
  };
};
