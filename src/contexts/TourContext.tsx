import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentTour: TourStep[];
  showWelcome: boolean;
  startTour: (tourType: 'worker' | 'admin') => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  skipTour: () => void;
  showTourPrompt: () => void;
  hideTourPrompt: () => void;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

const WORKER_TOUR_STEPS: TourStep[] = [
  {
    id: 'jobs',
    target: '[data-tour="worker-jobs"]',
    title: 'My Jobs / Bookings',
    content: 'Here you can see all the jobs assigned to you.',
    position: 'bottom'
  },
  {
    id: 'schedule',
    target: '[data-tour="worker-schedule"]',
    title: 'Set Schedule / Availability',
    content: 'Set your weekly availability so customers can book you.',
    position: 'bottom'
  },
  {
    id: 'earnings',
    target: '[data-tour="worker-earnings"]',
    title: 'Payments / Earnings',
    content: 'Track your completed jobs and payments here.',
    position: 'bottom'
  },
  {
    id: 'profile',
    target: '[data-tour="worker-profile"]',
    title: 'Profile Settings',
    content: 'Update your details, service areas, and notification preferences.',
    position: 'bottom'
  }
];

const ADMIN_TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard',
    target: '[data-tour="admin-dashboard"]',
    title: 'Dashboard Overview',
    content: 'Monitor all bookings, workers, and key stats in one place.',
    position: 'right'
  },
  {
    id: 'workers',
    target: '[data-tour="admin-workers"]',
    title: 'Worker Management',
    content: 'Add, edit, and assign workers for different jobs.',
    position: 'right'
  },
  {
    id: 'bookings',
    target: '[data-tour="admin-bookings"]',
    title: 'Booking Management',
    content: 'Track active, pending, and completed bookings here.',
    position: 'right'
  },
  {
    id: 'payments',
    target: '[data-tour="admin-payments"]',
    title: 'Payments & Invoices',
    content: 'View transactions, pending payments, and generate invoices.',
    position: 'right'
  },
  {
    id: 'settings',
    target: '[data-tour="admin-settings"]',
    title: 'System Settings',
    content: 'Control app settings, notifications, and integrations.',
    position: 'right'
  }
];

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentTour, setCurrentTour] = useState<TourStep[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const { user, profile } = useAuth();

  // Check if user has taken tour before
  useEffect(() => {
    const checkTourStatus = () => {
      if (!user || !profile) return;
      
      try {
        const tourKey = `tour_completed_${user.id}_${profile.role}`;
        const hasCompletedTour = localStorage.getItem(tourKey) === 'true';
        
        // Show welcome prompt if tour not completed and user is on appropriate dashboard
        if (!hasCompletedTour && (profile.role === 'worker' || profile.role === 'admin')) {
          // Delay to ensure page is fully loaded
          setTimeout(() => {
            setShowWelcome(true);
          }, 1500);
        }
      } catch (error) {
        console.error('Error checking tour status:', error);
      }
    };

    checkTourStatus();
  }, [user, profile]);

  const startTour = useCallback((tourType: 'worker' | 'admin') => {
    const steps = tourType === 'worker' ? WORKER_TOUR_STEPS : ADMIN_TOUR_STEPS;
    setCurrentTour(steps);
    setCurrentStep(0);
    setIsActive(true);
    setShowWelcome(false);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => {
      if (prev < currentTour.length - 1) {
        return prev + 1;
      }
      return prev;
    });
  }, [currentTour.length]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => {
      if (prev > 0) {
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setCurrentTour([]);
    setShowWelcome(false);
    
    // Mark tour as completed
    if (user && profile) {
      try {
        const tourKey = `tour_completed_${user.id}_${profile.role}`;
        localStorage.setItem(tourKey, 'true');
      } catch (error) {
        console.error('Error saving tour completion:', error);
      }
    }
  }, [user, profile]);

  const skipTour = useCallback(() => {
    setShowWelcome(false);
    
    // Mark tour as completed (skipped)
    if (user && profile) {
      try {
        const tourKey = `tour_completed_${user.id}_${profile.role}`;
        localStorage.setItem(tourKey, 'true');
      } catch (error) {
        console.error('Error saving tour skip:', error);
      }
    }
  }, [user, profile]);

  const showTourPrompt = useCallback(() => {
    setShowWelcome(true);
  }, []);

  const hideTourPrompt = useCallback(() => {
    setShowWelcome(false);
  }, []);

  const value: TourContextValue = {
    isActive,
    currentStep,
    totalSteps: currentTour.length,
    currentTour,
    showWelcome,
    startTour,
    nextStep,
    prevStep,
    endTour,
    skipTour,
    showTourPrompt,
    hideTourPrompt
  };

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}