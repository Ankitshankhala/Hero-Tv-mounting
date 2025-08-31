import React from 'react';
import { cn } from '@/lib/utils';
import heroMascotSvg from '@/assets/hero-mascot.svg';

interface HeroMascotProps {
  message?: string;
  className?: string;
  animated?: boolean;
}

export const HeroMascot: React.FC<HeroMascotProps> = ({ 
  message = "I'm here to help!", 
  className = "",
  animated = true 
}) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(
        "w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20",
        animated && "animate-pulse"
      )}>
        <img 
          src={heroMascotSvg} 
          alt="Hero mascot" 
          className="w-8 h-8"
        />
      </div>
      {message && (
        <div className="relative">
          <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-sm">
            <p className="text-sm text-foreground font-medium">{message}</p>
          </div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-card border-l border-b border-border rotate-45"></div>
        </div>
      )}
    </div>
  );
};