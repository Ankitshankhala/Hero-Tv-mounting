import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { useTour } from '@/contexts/TourContext';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TourTrigger() {
  const { showTourPrompt } = useTour();
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  if (!profile || (profile.role !== 'worker' && profile.role !== 'admin')) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={isMobile ? "icon" : "sm"}
            onClick={showTourPrompt}
            className={`fixed z-50 bg-background/80 backdrop-blur-sm border border-border hover:bg-accent ${
              isMobile 
                ? "bottom-20 right-4 h-12 w-12 rounded-full shadow-lg" 
                : "top-4 right-4"
            }`}
          >
            <HelpCircle className={`h-4 w-4 ${!isMobile ? "mr-1" : ""}`} />
            {!isMobile && "Take Tour"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Take a guided tour of the dashboard</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}