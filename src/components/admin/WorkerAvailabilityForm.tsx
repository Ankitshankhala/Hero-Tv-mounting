
import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { WorkerFormData } from '@/hooks/useWorkerForm';

interface WorkerAvailabilityFormProps {
  formData: WorkerFormData;
  onAvailabilityChange: (day: string, checked: boolean) => void;
}

const availableDays = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

export const WorkerAvailabilityForm = ({ formData, onAvailabilityChange }: WorkerAvailabilityFormProps) => {
  return (
    <div className="space-y-4">
      <Label>Availability</Label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {availableDays.map((day) => (
          <div key={day.key} className="flex items-center space-x-2">
            <Checkbox
              id={day.key}
              checked={formData.availability[day.key as keyof typeof formData.availability]}
              onCheckedChange={(checked) => onAvailabilityChange(day.key, checked as boolean)}
            />
            <Label htmlFor={day.key} className="text-sm">{day.label}</Label>
          </div>
        ))}
      </div>
    </div>
  );
};
