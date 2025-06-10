
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkerFormData } from '@/hooks/useWorkerForm';

interface WorkerLocationFormProps {
  formData: WorkerFormData;
  onInputChange: (field: keyof Omit<WorkerFormData, 'availability'>, value: string) => void;
}

export const WorkerLocationForm = ({ formData, onInputChange }: WorkerLocationFormProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          value={formData.city}
          onChange={(e) => onInputChange('city', e.target.value)}
          required
          placeholder="New York"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="region">Service Region</Label>
        <Input
          id="region"
          value={formData.region}
          onChange={(e) => onInputChange('region', e.target.value)}
          required
          placeholder="Downtown, Manhattan"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="zipcode">Zipcode</Label>
        <Input
          id="zipcode"
          value={formData.zipcode}
          onChange={(e) => onInputChange('zipcode', e.target.value)}
          required
          placeholder="10001"
        />
      </div>
    </div>
  );
};
