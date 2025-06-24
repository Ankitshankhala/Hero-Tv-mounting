
import { useEffect } from 'react';
import { useBookingFormState } from './useBookingFormState';
import { useWorkerAvailability } from './useWorkerAvailability';
import { useBookingOperations } from './useBookingOperations';
import { ServiceItem } from './types';

export const useBookingFlowState = (selectedServices: ServiceItem[] = []) => {
  const formState = useBookingFormState(selectedServices);
  const workerAvailability = useWorkerAvailability();
  const bookingOperations = useBookingOperations();

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
    handleBookingSubmit
  };
};
