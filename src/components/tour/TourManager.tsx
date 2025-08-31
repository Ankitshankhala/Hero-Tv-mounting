import React, { useEffect } from 'react';
import { TourOverlay } from './TourOverlay';
import { TourWelcome } from './TourWelcome';
import { TourTrigger } from './TourTrigger';
import { useTour } from '@/contexts/TourContext';

export function TourManager() {
  const { showTourPrompt } = useTour();

  // Keyboard shortcut: Shift + /
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === '?') {
        event.preventDefault();
        showTourPrompt();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showTourPrompt]);

  return (
    <>
      <TourWelcome />
      <TourOverlay />
      <TourTrigger />
    </>
  );
}