
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkerFormData } from '@/hooks/useWorkerForm';

interface WorkerPersonalInfoFormProps {
  formData: WorkerFormData;
  onInputChange: (field: keyof Omit<WorkerFormData, 'availability'>, value: string) => void;
}

export const WorkerPersonalInfoForm = ({ formData, onInputChange }: WorkerPersonalInfoFormProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => onInputChange('name', e.target.value)}
          required
          placeholder="John Doe"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => onInputChange('email', e.target.value)}
          required
          placeholder="worker@company.com"
        />
        <p className="text-xs text-gray-500">Use a real email address (not @example.com)</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => onInputChange('phone', e.target.value)}
          required
          placeholder="(555) 123-4567"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => onInputChange('password', e.target.value)}
          required
          placeholder="Temporary password"
          minLength={6}
        />
        <p className="text-xs text-gray-500">Minimum 6 characters</p>
      </div>
    </div>
  );
};
