
import React from 'react';
import { CheckCircle, Star, User, CalendarIcon, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
}

interface BookingProgressStepsProps {
  currentStep: number;
}

export const BookingProgressSteps = ({ currentStep }: BookingProgressStepsProps) => {
  const steps: Step[] = [
    { number: 1, title: 'Services', description: 'Configure services', icon: Star },
    { number: 2, title: 'Details', description: 'Contact & location', icon: User },
    { number: 3, title: 'Schedule', description: 'Date & time', icon: CalendarIcon },
    { number: 4, title: 'Payment', description: 'Secure payment', icon: CreditCard }
  ];

  return (
    <div className="flex justify-center overflow-x-auto pb-4 sm:pb-2">
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-fit">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center space-y-2">
                <div className={cn(
                  "relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                  currentStep >= step.number 
                    ? "bg-white text-slate-800 shadow-lg scale-110" 
                    : "bg-white/10 text-white scale-100 border border-white/20"
                )}>
                  {currentStep > step.number ? (
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                  ) : (
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                  {currentStep === step.number && (
                    <div className="absolute -inset-1 bg-white/20 rounded-full animate-pulse"></div>
                  )}
                </div>
                <div className="text-center min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-white truncate">{step.title}</div>
                  <div className="text-xs text-slate-300 truncate hidden sm:block">{step.description}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-8 sm:w-12 h-0.5 mx-2 sm:mx-4 transition-colors duration-300 flex-shrink-0",
                  currentStep > step.number ? "bg-white" : "bg-white/20"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
