import React from 'react';
import { TourOverlay } from './TourOverlay';
import { TourWelcome } from './TourWelcome';
import { TourTrigger } from './TourTrigger';

export function TourManager() {
  return (
    <>
      <TourWelcome />
      <TourOverlay />
      <TourTrigger />
    </>
  );
}