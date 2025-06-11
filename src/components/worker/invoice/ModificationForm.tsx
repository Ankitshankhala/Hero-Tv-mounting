
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
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

interface ModificationFormData {
  reason: string;
}

export const ModificationForm: React.FC<ModificationFormProps> = ({
  reason,
  onReasonChange,
  onSubmit,
  onCancel,
  loading,
  servicesCount
}) => {
  const methods = useForm<ModificationFormData>({
    defaultValues: {
      reason: reason
    }
  });

  const handleSubmit = (data: ModificationFormData) => {
    onReasonChange(data.reason);
    onSubmit();
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-4 mt-6">
        <FormField
          control={methods.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="reason" className="text-white">Reason for Modification</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  id="reason"
                  placeholder="Explain why the invoice is being modified (e.g., customer requested additional services)"
                  className="bg-slate-700 border-slate-600 text-white"
                  rows={3}
                  onChange={(e) => {
                    field.onChange(e);
                    onReasonChange(e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || servicesCount === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Creating...' : 'Create Modification'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};
