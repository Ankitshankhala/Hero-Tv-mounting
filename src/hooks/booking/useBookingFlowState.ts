
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

  // Destructure formState excluding conflicting properties
  const {
    currentStep: _formCurrentStep,
    setCurrentStep: _formSetCurrentStep,
    loading: _formLoading,
    setLoading: _formSetLoading,
    bookingId: _formBookingId,
    setBookingId: _formSetBookingId,
    handleBookingSubmit: _formHandleBookingSubmit,
    showSuccess: _formShowSuccess,
    successAnimation: _formSuccessAnimation,
    ...cleanFormState
  } = formState;

  // Destructure workerAvailability excluding conflicting properties
  const {
    currentStep: _workerCurrentStep,
    setCurrentStep: _workerSetCurrentStep,
    loading: _workerLoading,
    setLoading: _workerSetLoading,
    bookingId: _workerBookingId,
    setBookingId: _workerSetBookingId,
    handleBookingSubmit: _workerHandleBookingSubmit,
    showSuccess: _workerShowSuccess,
    successAnimation: _workerSuccessAnimation,
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
