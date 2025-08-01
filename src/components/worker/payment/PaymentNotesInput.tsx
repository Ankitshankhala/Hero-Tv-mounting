
import React from 'react';
import { FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

interface PaymentNotesInputProps {
  notes: string;
  onNotesChange: (value: string) => void;
}

const PaymentNotesInput = ({ notes, onNotesChange }: PaymentNotesInputProps) => {
  return (
    <FormItem>
      <FormLabel className="text-slate-300">Notes (Optional)</FormLabel>
      <FormControl>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Any notes about this payment..."
          rows={3}
          className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
};

export default PaymentNotesInput;
