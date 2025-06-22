
import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SpecialInstructionsSectionProps {
  formData: {
    specialInstructions: string;
  };
  onInputChange: (field: string, value: string) => void;
}

export const SpecialInstructionsSection = ({
  formData,
  onInputChange
}: SpecialInstructionsSectionProps) => {
  return (
    <div className="bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-200 rounded-2xl p-6 shadow-sm">
      <Label htmlFor="specialInstructions" className="text-lg font-bold text-gray-800 mb-4 block">
        Special Instructions (Optional)
      </Label>
      <Textarea
        id="specialInstructions"
        value={formData.specialInstructions}
        onChange={(e) => onInputChange('specialInstructions', e.target.value)}
        placeholder="Any special instructions, access codes, parking info, or specific requests..."
        className="min-h-[100px] text-black border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg resize-none bg-white/80 transition-all duration-200"
        rows={4}
      />
    </div>
  );
};
