
import { useState } from 'react';

export interface DayAvailability {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface WorkerFormData {
  name: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  zipcode: string;
  password: string;
  availability: {
    monday: DayAvailability;
    tuesday: DayAvailability;
    wednesday: DayAvailability;
    thursday: DayAvailability;
    friday: DayAvailability;
    saturday: DayAvailability;
    sunday: DayAvailability;
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
      monday: { enabled: false, startTime: '08:00', endTime: '18:00' },
      tuesday: { enabled: false, startTime: '08:00', endTime: '18:00' },
      wednesday: { enabled: false, startTime: '08:00', endTime: '18:00' },
      thursday: { enabled: false, startTime: '08:00', endTime: '18:00' },
      friday: { enabled: false, startTime: '08:00', endTime: '18:00' },
      saturday: { enabled: false, startTime: '08:00', endTime: '18:00' },
      sunday: { enabled: false, startTime: '08:00', endTime: '18:00' },
    },
    skills: '',
  });

  const handleInputChange = (field: keyof Omit<WorkerFormData, 'availability'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvailabilityChange = (day: string, field: 'enabled' | 'startTime' | 'endTime', value: boolean | string) => {
    setFormData(prev => ({
      ...prev,
      availability: { 
        ...prev.availability, 
        [day]: { 
          ...prev.availability[day as keyof typeof prev.availability], 
          [field]: value 
        }
      }
    }));
  };

  return {
    formData,
    handleInputChange,
    handleAvailabilityChange,
  };
};
