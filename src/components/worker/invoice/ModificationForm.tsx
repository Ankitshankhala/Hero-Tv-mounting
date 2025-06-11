
import React from 'react';
import { FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
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
      <FormItem>
        <FormLabel htmlFor="reason" className="text-white">Reason for Modification</FormLabel>
        <FormControl>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Explain why the invoice is being modified (e.g., customer requested additional services)"
            className="bg-slate-700 border-slate-600 text-white"
            rows={3}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

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
