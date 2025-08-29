
import { useState, useEffect } from 'react';
import { ServiceItem, FormData } from './types';
import { useTestingMode, getEffectiveMinimumAmount, getEffectiveServicePrice } from '@/contexts/TestingModeContext';

export const useBookingFormState = (selectedServices: ServiceItem[] = []) => {
  const { isTestingMode } = useTestingMode();
  const MINIMUM_BOOKING_AMOUNT = getEffectiveMinimumAmount(isTestingMode);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<ServiceItem[]>(selectedServices);
  const [formData, setFormData] = useState<FormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    zipcode: '',
    houseNumber: '',
    apartmentName: '',
    address: '',
    city: '',
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
    return services.reduce((total, service, index) => {
      const effectivePrice = getEffectiveServicePrice(service.price, isTestingMode, index);
      console.log(`Testing mode: ${isTestingMode}, Service: ${service.name}, Original: $${service.price}, Effective: $${effectivePrice}`);
      return total + (effectivePrice * service.quantity);
    }, 0);
  };

  const isMinimumCartMet = () => {
    return getTotalPrice() >= MINIMUM_BOOKING_AMOUNT;
  };

  const getAmountNeeded = () => {
    return Math.max(0, MINIMUM_BOOKING_AMOUNT - getTotalPrice());
  };

  const handleZipcodeChange = (zipcode: string, cityState?: string) => {
    setFormData(prev => ({ ...prev, zipcode }));
    
    if (cityState) {
      const [city, state] = cityState.split(', ');
      setFormData(prev => ({ 
        ...prev,
        city: city || prev.city
      }));
    }
  };

  const isStep1Valid = services.length > 0 && isMinimumCartMet();
  const isStep2Valid = formData.customerName && formData.customerEmail && formData.customerPhone && formData.address && formData.zipcode && formData.houseNumber;
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
    isMinimumCartMet,
    getAmountNeeded,
    handleZipcodeChange,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    MINIMUM_BOOKING_AMOUNT
  };
};
