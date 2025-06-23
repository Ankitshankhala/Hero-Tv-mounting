
import React from 'react';
import { X, CalendarIcon } from 'lucide-react';

interface BookingFlowHeaderProps {
  currentStep: number;
  onClose: () => void;
}

export const BookingFlowHeader = ({ currentStep, onClose }: BookingFlowHeaderProps) => {
  return (
    <div className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white px-4 sm:px-8 py-4 sm:py-6 rounded-t-2xl border-b border-slate-600/50">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/10 rounded-lg transition-all duration-200"
      >
        <X className="h-5 w-5" />
      </button>
      
      <div className="flex items-center space-x-3">
        <div className="p-2 sm:p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
          <CalendarIcon className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Book Your Service</h2>
          <p className="text-slate-300 text-xs sm:text-sm">Step {currentStep} of 4</p>
        </div>
      </div>
    </div>
  );
};
