
import { useEffect } from 'react';
import { useBookingFormState } from './useBookingFormState';
import { useWorkerAvailability } from './useWorkerAvailability';
import { useBookingOperations } from './useBookingOperations';
import { ServiceItem } from './types';

export const useBookingFlowState = (selectedServices: ServiceItem[] = []) => {
  const formState = useBookingFormState(selectedServices);
  const workerAvailability = useWorkerAvailability();
  const bookingOperations = useBookingOperations();

  // Calculate total service duration from selected services
  const getTotalServiceDuration = () => {
    // If services have duration, sum them up, otherwise default to 60 minutes
    const totalDuration = formState.services.reduce((total, service) => {
      // Assuming each service takes about 60 minutes by default
      // This could be enhanced to read from service metadata
      const serviceDuration = service.quantity * 60; // 60 minutes per service
      return total + serviceDuration;
    }, 0);
    
    return Math.max(totalDuration, 60); // Minimum 60 minutes
  };

  // Fetch worker availability when date/zipcode changes
  useEffect(() => {
    if (formState.formData.selectedDate && formState.formData.zipcode) {
      const serviceDuration = getTotalServiceDuration();
      workerAvailability.fetchWorkerAvailability(
        formState.formData.selectedDate, 
        formState.formData.zipcode,
        serviceDuration
      );
    }
  }, [formState.formData.selectedDate, formState.formData.zipcode, formState.services.length]);

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
    handleBookingSubmit,
    getTotalServiceDuration
  };
};
