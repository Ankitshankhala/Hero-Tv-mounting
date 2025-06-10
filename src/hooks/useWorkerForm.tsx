
import { useState } from 'react';

export interface WorkerFormData {
  name: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  zipcode: string;
  password: string;
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  skills: string;
}

export const useWorkerForm = () => {
  const [formData, setFormData] = useState<WorkerFormData>({
    name: '',
    email: '',
    phone: '',
    city: '',
    region: '',
    zipcode: '',
    password: '',
    availability: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    },
    skills: '',
  });

  const handleInputChange = (field: keyof Omit<WorkerFormData, 'availability'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvailabilityChange = (day: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      availability: { ...prev.availability, [day]: checked }
    }));
  };

  return {
    formData,
    handleInputChange,
    handleAvailabilityChange,
  };
};
