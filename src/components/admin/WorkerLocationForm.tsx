
import React from 'react';
import { FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { WorkerFormData } from '@/hooks/useWorkerForm';

interface WorkerLocationFormProps {
  formData: WorkerFormData;
  onInputChange: (field: keyof Omit<WorkerFormData, 'availability'>, value: string) => void;
}

export const WorkerLocationForm = ({ formData, onInputChange }: WorkerLocationFormProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <FormItem>
        <FormLabel htmlFor="city">City</FormLabel>
        <FormControl>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => onInputChange('city', e.target.value)}
            required
            placeholder="New York"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
      
      <FormItem>
        <FormLabel htmlFor="region">Service Region</FormLabel>
        <FormControl>
          <Input
            id="region"
            value={formData.region}
            onChange={(e) => onInputChange('region', e.target.value)}
            required
            placeholder="Downtown, Manhattan"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
      
      <FormItem>
        <FormLabel htmlFor="zipcode">Zipcode</FormLabel>
        <FormControl>
          <Input
            id="zipcode"
            value={formData.zipcode}
            onChange={(e) => onInputChange('zipcode', e.target.value)}
            required
            placeholder="10001"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </div>
  );
};
