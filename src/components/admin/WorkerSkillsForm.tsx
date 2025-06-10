
import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WorkerFormData } from '@/hooks/useWorkerForm';

interface WorkerSkillsFormProps {
  formData: WorkerFormData;
  onInputChange: (field: keyof Omit<WorkerFormData, 'availability'>, value: string) => void;
}

export const WorkerSkillsForm = ({ formData, onInputChange }: WorkerSkillsFormProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="skills">Skills & Notes</Label>
      <Textarea
        id="skills"
        value={formData.skills}
        onChange={(e) => onInputChange('skills', e.target.value)}
        placeholder="Any relevant skills or notes..."
      />
    </div>
  );
};
