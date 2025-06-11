
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { WorkerFormData } from '@/hooks/useWorkerForm';

interface WorkerPersonalInfoFormProps {
  formData: WorkerFormData;
  onInputChange: (field: keyof Omit<WorkerFormData, 'availability'>, value: string) => void;
}

interface PersonalInfoFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export const WorkerPersonalInfoForm = ({ formData, onInputChange }: WorkerPersonalInfoFormProps) => {
  const methods = useForm<PersonalInfoFormData>({
    defaultValues: {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password
    }
  });

  return (
    <FormProvider {...methods}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={methods.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="name">Full Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id="name"
                  required
                  placeholder="John Doe"
                  onChange={(e) => {
                    field.onChange(e);
                    onInputChange('name', e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={methods.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="email">Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id="email"
                  type="email"
                  required
                  placeholder="worker@gmail.com"
                  onChange={(e) => {
                    field.onChange(e);
                    onInputChange('email', e.target.value);
                  }}
                />
              </FormControl>
              <FormDescription>
                Use Gmail, Yahoo, or your company domain (avoid test/fake domains)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={methods.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="phone">Phone Number</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id="phone"
                  required
                  placeholder="(555) 123-4567"
                  onChange={(e) => {
                    field.onChange(e);
                    onInputChange('phone', e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={methods.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="password">Password</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id="password"
                  type="password"
                  required
                  placeholder="Temporary password"
                  minLength={6}
                  onChange={(e) => {
                    field.onChange(e);
                    onInputChange('password', e.target.value);
                  }}
                />
              </FormControl>
              <FormDescription>
                Minimum 6 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormProvider>
  );
};
