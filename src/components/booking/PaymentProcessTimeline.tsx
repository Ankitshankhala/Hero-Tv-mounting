import React from 'react';
import { CreditCard, Wrench, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentProcessTimelineProps {
  currentStep: 1 | 2 | 3;
  className?: string;
}

export const PaymentProcessTimeline = ({ currentStep, className = '' }: PaymentProcessTimelineProps) => {
  const steps = [
    {
      icon: CreditCard,
      title: 'Payment Authorized',
      description: 'Booking confirmed',
      step: 1
    },
    {
      icon: Wrench,
      title: 'Service in Progress',
      description: 'Worker assigned & completing job',
      step: 2
    },
    {
      icon: CheckCircle,
      title: 'Payment Charged',
      description: 'Service completed & paid',
      step: 3
    }
  ];

  return (
    <div className={`bg-muted/30 rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-4 text-center">Payment Process</h3>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep >= step.step;
          const isCurrent = currentStep === step.step;
          
          return (
            <React.Fragment key={step.step}>
              <div className="flex flex-col items-center space-y-2 flex-1">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "border-2 border-muted-foreground text-muted-foreground",
                  isCurrent && "ring-2 ring-primary/20"
                )}>
                  {isActive ? <Icon className="h-4 w-4" /> : step.step}
                </div>
                <div className="text-center">
                  <div className={cn(
                    "text-xs font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </div>
                </div>
              </div>
              
              {index < steps.length - 1 && (
                <div className={cn(
                  "h-px flex-1 mx-2 transition-all",
                  currentStep > step.step ? "bg-primary" : "bg-border"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};