
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { WorkerFormData } from '@/hooks/useWorkerForm';

interface WorkerLocationFormProps {
  formData: WorkerFormData;
  onInputChange: (field: keyof Omit<WorkerFormData, 'availability'>, value: string) => void;
}

interface LocationFormData {
  city: string;
  region: string;
  zipcode: string;
}

export const WorkerLocationForm = ({ formData, onInputChange }: WorkerLocationFormProps) => {
  const methods = useForm<LocationFormData>({
    defaultValues: {
      city: formData.city,
      region: formData.region,
      zipcode: formData.zipcode
    }
  });

  return (
    <FormProvider {...methods}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          control={methods.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="city">City</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id="city"
                  required
                  placeholder="New York"
                  onChange={(e) => {
                    field.onChange(e);
                    onInputChange('city', e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={methods.control}
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="region">Service Region</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id="region"
                  required
                  placeholder="Downtown, Manhattan"
                  onChange={(e) => {
                    field.onChange(e);
                    onInputChange('region', e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={methods.control}
          name="zipcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="zipcode">Zipcode</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id="zipcode"
                  required
                  placeholder="10001"
                  onChange={(e) => {
                    field.onChange(e);
                    onInputChange('zipcode', e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormProvider>
  );
};
