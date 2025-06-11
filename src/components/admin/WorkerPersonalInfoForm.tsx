
import React from 'react';
import { FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { WorkerFormData } from '@/hooks/useWorkerForm';

interface WorkerPersonalInfoFormProps {
  formData: WorkerFormData;
  onInputChange: (field: keyof Omit<WorkerFormData, 'availability'>, value: string) => void;
}

export const WorkerPersonalInfoForm = ({ formData, onInputChange }: WorkerPersonalInfoFormProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormItem>
        <FormLabel htmlFor="name">Full Name</FormLabel>
        <FormControl>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => onInputChange('name', e.target.value)}
            required
            placeholder="John Doe"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
      
      <FormItem>
        <FormLabel htmlFor="email">Email</FormLabel>
        <FormControl>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => onInputChange('email', e.target.value)}
            required
            placeholder="worker@gmail.com"
          />
        </FormControl>
        <FormDescription>
          Use Gmail, Yahoo, or your company domain (avoid test/fake domains)
        </FormDescription>
        <FormMessage />
      </FormItem>
      
      <FormItem>
        <FormLabel htmlFor="phone">Phone Number</FormLabel>
        <FormControl>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => onInputChange('phone', e.target.value)}
            required
            placeholder="(555) 123-4567"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
      
      <FormItem>
        <FormLabel htmlFor="password">Password</FormLabel>
        <FormControl>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => onInputChange('password', e.target.value)}
            required
            placeholder="Temporary password"
            minLength={6}
          />
        </FormControl>
        <FormDescription>
          Minimum 6 characters
        </FormDescription>
        <FormMessage />
      </FormItem>
    </div>
  );
};
