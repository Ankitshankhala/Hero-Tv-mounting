
import React from 'react';
import { CheckCircle, Calendar, CreditCard, User, Gift, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  friendlyTitle: string;
}

interface BookingProgressStepsProps {
  currentStep: number;
}

export const BookingProgressSteps = ({ currentStep }: BookingProgressStepsProps) => {
  const steps: Step[] = [
    { 
      number: 1, 
      title: 'Service', 
      description: 'Configure services',
      friendlyTitle: 'Let\'s get your wall ready!',
      icon: Tv 
    },
    { 
      number: 2, 
      title: 'Contact', 
      description: 'Contact & location',
      friendlyTitle: 'Where can our hero help you?',
      icon: User 
    },
    { 
      number: 3, 
      title: 'Schedule', 
      description: 'Date & time',
      friendlyTitle: 'Choose your heroic visit time!',
      icon: Calendar 
    },
    { 
      number: 4, 
      title: 'Tip', 
      description: 'Worker tip',
      friendlyTitle: 'Show some love to your hero!',
      icon: Gift 
    },
    { 
      number: 5, 
      title: 'Payment', 
      description: 'Authorize payment',
      friendlyTitle: 'Almost there, hero!',
      icon: CreditCard 
    }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Hero progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
          <span>Your Hero Journey</span>
          <span>{currentStep} of {steps.length} complete</span>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-700 ease-out rounded-full"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          const isUpcoming = step.number > currentStep;
          const Icon = step.icon;
          
          return (
            <React.Fragment key={step.number}>
              {/* Step Circle */}
              <div className="flex flex-col items-center relative">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-500 shadow-sm",
                    isCompleted && "bg-gradient-to-br from-green-500 to-green-600 border-green-500 animate-scale-in",
                    isCurrent && "border-primary bg-gradient-to-br from-primary/20 to-primary/10 animate-pulse shadow-lg shadow-primary/25",
                    isUpcoming && "border-slate-600 bg-slate-800/50"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Icon
                      className={cn(
                        "w-6 h-6 transition-colors duration-300",
                        isCurrent && "text-primary",
                        isUpcoming && "text-slate-500"
                      )}
                    />
                  )}
                </div>
                
                {/* Step Info */}
                <div className="mt-3 text-center">
                  <div
                    className={cn(
                      "text-sm font-medium transition-colors duration-300",
                      isCurrent && "text-primary",
                      isCompleted && "text-green-400",
                      isUpcoming && "text-slate-400"
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 hidden sm:block max-w-20">
                    {step.description}
                  </div>
                </div>
              </div>
              
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-2 relative">
                  <div className="h-0.5 bg-slate-700/50 rounded-full" />
                  <div
                    className={cn(
                      "h-0.5 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-700 ease-out absolute top-0 left-0",
                      isCompleted ? "w-full" : "w-0"
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
