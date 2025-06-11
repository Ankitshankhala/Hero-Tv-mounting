
import React from 'react';

interface BookingProgressProps {
  currentStep: number;
}

export const BookingProgress = ({ currentStep }: BookingProgressProps) => {
  return (
    <div className="flex justify-center mb-8">
      <div className="flex items-center space-x-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep >= i ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
            }`}>
              {i}
            </div>
            {i < 5 && <div className={`w-12 h-1 ${currentStep > i ? 'bg-blue-600' : 'bg-slate-700'}`} />}
          </div>
        ))}
      </div>
    </div>
  );
};
