
import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ModificationFormProps {
  reason: string;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
  servicesCount: number;
}

export const ModificationForm: React.FC<ModificationFormProps> = ({
  reason,
  onReasonChange,
  onSubmit,
  onCancel,
  loading,
  servicesCount
}) => {
  return (
    <div className="space-y-4 mt-6">
      <div>
        <Label htmlFor="reason" className="text-white">Reason for Modification</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Explain why the invoice is being modified (e.g., customer requested additional services)"
          className="mt-2 bg-slate-700 border-slate-600 text-white"
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={loading || servicesCount === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? 'Creating...' : 'Create Modification'}
        </Button>
      </div>
    </div>
  );
};
