
import { useEffect } from 'react';
import { useBookingFormState } from './useBookingFormState';
import { useZctaWorkerAvailability } from './useZctaWorkerAvailability';
import { useBookingOperations } from './useBookingOperations';
import { ServiceItem } from './types';

export const useBookingFlowState = (selectedServices: ServiceItem[] = []) => {
  const formState = useBookingFormState(selectedServices);
  const workerAvailability = useZctaWorkerAvailability();
  const bookingOperations = useBookingOperations();

  // Fetch worker availability when date/zipcode changes
  useEffect(() => {
    if (formState.formData.selectedDate && formState.formData.zipcode) {
      workerAvailability.fetchWorkerAvailability(
        formState.formData.selectedDate, 
        formState.formData.zipcode,
        formState.formData.preferredWorkerId
      );
    }
  }, [formState.formData.selectedDate, formState.formData.zipcode, formState.formData.preferredWorkerId]);

  // Trigger success animation
  useEffect(() => {
    if (bookingOperations.showSuccess) {
      setTimeout(() => bookingOperations.setSuccessAnimation(true), 100);
    }
  }, [bookingOperations.showSuccess]);

  return {
    ...formState,
    ...workerAvailability,
    ...bookingOperations
  };
};
