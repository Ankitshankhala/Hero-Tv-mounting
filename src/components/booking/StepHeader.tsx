import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeroMascot } from './HeroMascot';

interface StepHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  heroMessage?: string;
  className?: string;
  step?: number;
  totalSteps?: number;
}

export const StepHeader: React.FC<StepHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  heroMessage,
  className = "",
  step,
  totalSteps
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Step indicator */}
      {step && totalSteps && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step} of {totalSteps}</span>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i < step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Main header */}
      <div className="text-center space-y-3">
        {Icon && (
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
            <Icon className="w-8 h-8 text-primary" />
          </div>
        )}
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-muted-foreground max-w-md mx-auto">{subtitle}</p>
          )}
        </div>
      </div>
      
      {/* Hero mascot */}
      {heroMessage && (
        <div className="flex justify-center">
          <HeroMascot message={heroMessage} animated />
        </div>
      )}
    </div>
  );
};