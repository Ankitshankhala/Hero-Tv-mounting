import React, { useEffect, useState } from 'react';
import { useTour } from '@/contexts/TourContext';
import { TourTooltip } from './TourTooltip';
import { createPortal } from 'react-dom';

export function TourOverlay() {
  const { isActive, currentStep, currentTour } = useTour();
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isActive || !currentTour[currentStep]) return;

    const findTarget = () => {
      const target = document.querySelector(currentTour[currentStep].target) as HTMLElement;
      if (target) {
        setTargetElement(target);
        
        // Calculate tooltip position
        const rect = target.getBoundingClientRect();
        const position = currentTour[currentStep].position || 'bottom';
        
        let x = rect.left + rect.width / 2;
        let y = rect.bottom + 16;
        
        switch (position) {
          case 'top':
            y = rect.top - 16;
            break;
          case 'left':
            x = rect.left - 16;
            y = rect.top + rect.height / 2;
            break;
          case 'right':
            x = rect.right + 16;
            y = rect.top + rect.height / 2;
            break;
          case 'bottom':
          default:
            y = rect.bottom + 16;
            break;
        }
        
        setTooltipPosition({ x, y });
      }
    };

    // Try to find target immediately
    findTarget();
    
    // If not found, retry with a small delay
    const timeout = setTimeout(findTarget, 100);
    
    return () => clearTimeout(timeout);
  }, [isActive, currentStep, currentTour]);

  if (!isActive || !currentTour[currentStep] || !targetElement) {
    return null;
  }

  const targetRect = targetElement.getBoundingClientRect();

  return createPortal(
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/50 z-[9998] pointer-events-none" />
      
      {/* Highlighted element cutout */}
      <div 
        className="fixed z-[9999] pointer-events-none"
        style={{
          left: targetRect.left - 4,
          top: targetRect.top - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
          borderRadius: '8px'
        }}
      />
      
      {/* Tooltip */}
      <TourTooltip
        step={currentTour[currentStep]}
        position={tooltipPosition}
        targetRect={targetRect}
      />
    </>,
    document.body
  );
}