import React, { useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfetti } from '@/hooks/useConfetti';

interface StepCelebrationProps {
  isVisible: boolean;
  message?: string;
  onComplete?: () => void;
  className?: string;
}

export const StepCelebration: React.FC<StepCelebrationProps> = ({
  isVisible,
  message = "Great job!",
  onComplete,
  className = ""
}) => {
  const { triggerConfetti } = useConfetti();
  const elementRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) {
      // Trigger confetti animation
      setTimeout(() => {
        triggerConfetti(elementRef.current || undefined);
      }, 200);
      
      // Auto-hide after celebration
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, triggerConfetti, onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      ref={elementRef}
      className={cn(
        "fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm",
        "animate-fade-in",
        className
      )}
    >
      <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl max-w-sm mx-4 text-center animate-scale-in">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center animate-pulse">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">{message}</h3>
        <p className="text-muted-foreground text-sm">Moving to the next step...</p>
      </div>
    </div>
  );
};