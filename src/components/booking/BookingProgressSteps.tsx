
import React, { useState } from 'react';
import { CheckCircle, Calendar, CreditCard, User, Gift, Tv, ChevronDown, ChevronUp } from 'lucide-react';
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
  isCompact?: boolean;
  defaultCollapsed?: boolean;
}

export const BookingProgressSteps = ({ 
  currentStep, 
  isCompact = false, 
  defaultCollapsed = false 
}: BookingProgressStepsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
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

  if (isCompact) {
    return (
      <div className="w-full">
        {/* Compact Hero progress bar with toggle */}
        <div className="mb-3">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-between w-full text-sm text-slate-300 mb-2 hover:text-primary transition-colors"
          >
            <span>Your Hero Journey</span>
            <div className="flex items-center gap-2">
              <span>{currentStep} of {steps.length} complete</span>
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </button>
          <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-700 ease-out rounded-full"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Collapsible Steps */}
        {!isCollapsed && (
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCompleted = step.number < currentStep;
              const isCurrent = step.number === currentStep;
              const isUpcoming = step.number > currentStep;
              const Icon = step.icon;
              
              return (
                <React.Fragment key={step.number}>
                  {/* Compact Step Circle */}
                  <div className="flex flex-col items-center relative">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 shadow-sm",
                        isCompleted && "bg-gradient-to-br from-green-500 to-green-600 border-green-500",
                        isCurrent && "border-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg shadow-primary/25",
                        isUpcoming && "border-slate-600 bg-slate-800/50"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <Icon
                          className={cn(
                            "w-4 h-4 transition-colors duration-300",
                            isCurrent && "text-primary",
                            isUpcoming && "text-slate-500"
                          )}
                        />
                      )}
                    </div>
                    
                    {/* Compact Step Info */}
                    <div className="mt-1 text-center">
                      <div
                        className={cn(
                          "text-xs font-medium transition-colors duration-300",
                          isCurrent && "text-primary",
                          isCompleted && "text-green-400",
                          isUpcoming && "text-slate-400"
                        )}
                      >
                        {step.title}
                      </div>
                    </div>
                  </div>
                  
                  {/* Compact Connector Line */}
                  {index < steps.length - 1 && (
                    <div className="flex-1 mx-1 relative">
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
        )}
      </div>
    );
  }

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
