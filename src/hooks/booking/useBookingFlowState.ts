
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
      bookingOperations.setCurrentStep(4);
    }
  };

  // Destructure and filter out conflicting properties from other hooks
  const {
    showSuccess: _formShowSuccess,
    successAnimation: _formSuccessAnimation,
    currentStep: _formCurrentStep,
    setCurrentStep: _formSetCurrentStep,
    loading: _formLoading,
    setLoading: _formSetLoading,
    bookingId: _formBookingId,
    setBookingId: _formSetBookingId,
    handleBookingSubmit: _formHandleBookingSubmit,
    ...restFormState
  } = formState;

  const {
    showSuccess: _workerShowSuccess,
    successAnimation: _workerSuccessAnimation,
    currentStep: _workerCurrentStep,
    setCurrentStep: _workerSetCurrentStep,
    loading: _workerLoading,
    setLoading: _workerSetLoading,
    bookingId: _workerBookingId,
    setBookingId: _workerSetBookingId,
    handleBookingSubmit: _workerHandleBookingSubmit,
    ...restWorkerAvailability
  } = workerAvailability;

  // Return combined state with bookingOperations taking precedence for overlapping properties
  return {
    // Form state properties (excluding conflicting ones)
    ...restFormState,
    // Worker availability properties (excluding conflicting ones)
    ...restWorkerAvailability,
    // Override with bookingOperations properties (these take precedence and are the correct types)
    currentStep: bookingOperations.currentStep,
    setCurrentStep: bookingOperations.setCurrentStep,
    loading: bookingOperations.loading,
    setLoading: bookingOperations.setLoading,
    bookingId: bookingOperations.bookingId,
    setBookingId: bookingOperations.setBookingId,
    showSuccess: bookingOperations.showSuccess, // Ensure this is boolean
    setShowSuccess: bookingOperations.setShowSuccess,
    successAnimation: bookingOperations.successAnimation, // Ensure this is boolean
    setSuccessAnimation: bookingOperations.setSuccessAnimation,
    handleBookingSubmit, // Use our wrapper function
    user,
  };
};
