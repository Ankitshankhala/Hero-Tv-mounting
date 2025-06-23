
import { useState, useEffect } from 'react';
import { ServiceItem, FormData } from './types';

export const useBookingFormState = (selectedServices: ServiceItem[] = []) => {
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

  // Update services when props change
  useEffect(() => {
    setServices(selectedServices);
  }, [selectedServices]);

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

  const getTotalPrice = () => {
    return services.reduce((total, service) => total + (service.price * service.quantity), 0);
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
    updateServiceQuantity,
    removeService,
    getTotalPrice,
    handleZipcodeChange,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid
  };
};
