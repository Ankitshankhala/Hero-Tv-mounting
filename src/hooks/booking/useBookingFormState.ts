
import { useState, useEffect, useMemo } from 'react';
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
    specialInstructions: '',
    tipAmount: 0
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

  // Memoized service total calculation
  const serviceTotal = useMemo(() => {
    return services.reduce((total, service, index) => {
      const effectivePrice = getEffectiveServicePrice(service.price, isTestingMode, index);
      return total + (effectivePrice * service.quantity);
    }, 0);
  }, [services, isTestingMode]);

  const getTotalPrice = () => serviceTotal;

  const getTotalWithTip = () => {
    return serviceTotal + (formData.tipAmount || 0);
  };

  // Memoized derived values
  const isMinimumCartMet = useMemo(() => {
    return serviceTotal >= MINIMUM_BOOKING_AMOUNT;
  }, [serviceTotal, MINIMUM_BOOKING_AMOUNT]);

  const getAmountNeeded = useMemo(() => {
    return Math.max(0, MINIMUM_BOOKING_AMOUNT - serviceTotal);
  }, [MINIMUM_BOOKING_AMOUNT, serviceTotal]);

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

  // PHASE 1: Track service coverage state
  const [hasServiceCoverage, setHasServiceCoverage] = useState(false);

  const handleZctaValidationChange = (isValid: boolean, hasCoverage: boolean) => {
    // Update coverage state for blocking form progression
    console.log('ZCTA Validation:', { isValid, hasCoverage });
    setHasServiceCoverage(isValid && hasCoverage);
  };

  const isStep1Valid = services.length > 0 && isMinimumCartMet;
  // PHASE 1: Step 2 is only valid if service coverage is confirmed
  const isStep2Valid = formData.customerName && formData.customerEmail && formData.customerPhone && formData.address && formData.zipcode && formData.houseNumber && hasServiceCoverage;
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
    getTotalWithTip,
    isMinimumCartMet: () => isMinimumCartMet,
    getAmountNeeded: () => getAmountNeeded,
    handleZipcodeChange,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    hasServiceCoverage,
    MINIMUM_BOOKING_AMOUNT,
    handleZctaValidationChange
  };
};
