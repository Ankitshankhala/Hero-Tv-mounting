import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTour } from '@/contexts/TourContext';

interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourTooltipProps {
  step: TourStep;
  position: { x: number; y: number };
  targetRect: DOMRect;
}

export function TourTooltip({ step, position, targetRect }: TourTooltipProps) {
  const { currentStep, totalSteps, nextStep, prevStep, endTour } = useTour();
  
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  
  // Adjust tooltip position to stay within viewport
  const tooltipWidth = 320;
  const tooltipHeight = 200;
  const padding = 16;
  
  let adjustedX = position.x - tooltipWidth / 2;
  let adjustedY = position.y;
  
  // Keep tooltip within horizontal bounds
  if (adjustedX < padding) {
    adjustedX = padding;
  } else if (adjustedX + tooltipWidth > window.innerWidth - padding) {
    adjustedX = window.innerWidth - tooltipWidth - padding;
  }
  
  // Adjust vertical position based on step position
  if (step.position === 'top') {
    adjustedY = position.y - tooltipHeight - 16;
  } else if (step.position === 'left') {
    adjustedX = position.x - tooltipWidth - 16;
    adjustedY = position.y - tooltipHeight / 2;
  } else if (step.position === 'right') {
    adjustedX = position.x + 16;
    adjustedY = position.y - tooltipHeight / 2;
  }
  
  // Keep tooltip within vertical bounds
  if (adjustedY < padding) {
    adjustedY = padding;
  } else if (adjustedY + tooltipHeight > window.innerHeight - padding) {
    adjustedY = window.innerHeight - tooltipHeight - padding;
  }

  const handleFinish = () => {
    endTour();
  };

  return (
    <Card 
      className="fixed z-[10000] w-80 bg-background border-2 border-primary/20 shadow-2xl animate-scale-in"
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={endTour}
            className="h-6 w-6 p-0 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {step.content}
        </p>
        
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={prevStep}
            disabled={isFirstStep}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep 
                    ? 'bg-primary' 
                    : index < currentStep 
                      ? 'bg-primary/50' 
                      : 'bg-muted'
                }`}
              />
            ))}
          </div>
          
          {isLastStep ? (
            <Button
              size="sm"
              onClick={handleFinish}
              className="flex items-center gap-1"
            >
              Done 🚀
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={nextStep}
              className="flex items-center gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
