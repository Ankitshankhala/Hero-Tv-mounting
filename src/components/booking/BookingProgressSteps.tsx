
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
    { number: 4, title: 'Payment', description: 'Complete payment', icon: CreditCard }
  ];

  return (
    <div className="flex space-x-2 overflow-x-auto pb-2 sm:pb-0">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.number} className="flex items-center">
            <div className={cn(
              "relative w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
              currentStep >= step.number 
                ? "bg-white text-slate-800 shadow-lg scale-110" 
                : "bg-white/10 text-white scale-100 border border-white/20"
            )}>
              {currentStep > step.number ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {currentStep === step.number && (
                <div className="absolute -inset-1 bg-white/20 rounded-full animate-pulse"></div>
              )}
            </div>
            <div className="hidden sm:block ml-2 min-w-0">
              <div className="text-xs font-medium text-white">{step.title}</div>
              <div className="text-xs text-slate-300">{step.description}</div>
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                "w-4 sm:w-8 h-0.5 mx-2 transition-colors duration-300",
                currentStep > step.number ? "bg-white" : "bg-white/20"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
};
