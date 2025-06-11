
import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PaymentNotesInputProps {
  notes: string;
  onNotesChange: (value: string) => void;
}

const PaymentNotesInput = ({ notes, onNotesChange }: PaymentNotesInputProps) => {
  return (
    <div>
      <Label htmlFor="notes">Notes (Optional)</Label>
      <Textarea
        id="notes"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Any notes about this payment..."
        className="mt-1"
        rows={3}
      />
    </div>
  );
};

export default PaymentNotesInput;
