
import React from 'react';
import { Check, ShoppingCart, MapPin, Calendar, CheckCircle } from 'lucide-react';

interface BookingProgressProps {
  currentStep: number;
}

export const BookingProgress = ({ currentStep }: BookingProgressProps) => {
  const steps = [
    { 
      number: 1, 
      title: 'Select Services', 
      description: 'Choose your services',
      icon: ShoppingCart 
    },
    { 
      number: 2, 
      title: 'Location Details', 
      description: 'Enter your address',
      icon: MapPin 
    },
    { 
      number: 3, 
      title: 'Schedule', 
      description: 'Pick date & time',
      icon: Calendar 
    },
    { 
      number: 4, 
      title: 'Confirmation', 
      description: 'Review & confirm',
      icon: CheckCircle 
    }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-slate-700/50 -z-10">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>

        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const IconComponent = step.icon;

          return (
            <div key={step.number} className="flex flex-col items-center relative">
              {/* Step Circle */}
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10
                  ${isCompleted 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 border-green-500 shadow-lg shadow-green-500/25' 
                    : isCurrent 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 border-blue-500 shadow-lg shadow-blue-500/25 animate-pulse' 
                    : 'bg-slate-700/50 border-slate-600 backdrop-blur-sm'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 text-white" />
                ) : (
                  <IconComponent className={`h-5 w-5 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                )}
              </div>

              {/* Step Content */}
              <div className="mt-4 text-center min-w-0 max-w-32">
                <div
                  className={`
                    font-semibold text-sm transition-colors duration-300
                    ${isCompleted || isCurrent ? 'text-white' : 'text-slate-400'}
                  `}
                >
                  {step.title}
                </div>
                <div
                  className={`
                    text-xs mt-1 transition-colors duration-300
                    ${isCompleted ? 'text-green-300' : isCurrent ? 'text-blue-300' : 'text-slate-500'}
                  `}
                >
                  {step.description}
                </div>
              </div>

              {/* Active Step Glow Effect */}
              {isCurrent && (
                <div className="absolute inset-0 -m-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-lg -z-10 animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
