import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { useTour } from '@/contexts/TourContext';
import { useAuth } from '@/hooks/useAuth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TourTrigger() {
  const { showTourPrompt } = useTour();
  const { profile } = useAuth();

  if (!profile || (profile.role !== 'worker' && profile.role !== 'admin')) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={showTourPrompt}
            className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur-sm border border-border hover:bg-accent"
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            Take Tour
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Take a guided tour of the dashboard</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}