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

  // Only show floating button on mobile for workers/admins
  if (!profile || (profile.role !== 'worker' && profile.role !== 'admin') || !isMobile) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={showTourPrompt}
      className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-accent shadow-lg"
      aria-label="Take a guided tour of the dashboard"
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  );
}