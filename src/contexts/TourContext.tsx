import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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
  resetTourCompletion: (userId?: string, tourType?: string) => Promise<boolean>;
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

  // Check tour completion status from database
  const checkTourCompletionFromDB = useCallback(async (userId: string, tourType: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('tour_completion')
        .select('id')
        .eq('user_id', userId)
        .eq('tour_type', tourType)
        .maybeSingle();

      if (error) {
        console.error('Error checking tour completion from DB:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error in checkTourCompletionFromDB:', error);
      return false;
    }
  }, []);

  // Save tour completion to database
  const saveTourCompletionToDB = useCallback(async (userId: string, tourType: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tour_completion')
        .upsert({
          user_id: userId,
          tour_type: tourType,
          completed_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving tour completion to DB:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in saveTourCompletionToDB:', error);
      return false;
    }
  }, []);

  // Check if user has taken tour before
  useEffect(() => {
    const checkTourStatus = async () => {
      // Ensure both user and profile are loaded and profile has a role
      if (!user || !profile || !profile.role) return;
      
      try {
        const tourType = profile.role;
        const tourKey = `tour_completed_${user.id}_${tourType}`;
        
        // Check localStorage first (faster)
        const hasCompletedTourLocal = localStorage.getItem(tourKey) === 'true';
        
        // If not found in localStorage, check database
        let hasCompletedTour = hasCompletedTourLocal;
        if (!hasCompletedTourLocal) {
          hasCompletedTour = await checkTourCompletionFromDB(user.id, tourType);
          
          // If found in database, update localStorage for future checks
          if (hasCompletedTour) {
            localStorage.setItem(tourKey, 'true');
          }
        }
        
        console.log('Tour check:', { 
          userId: user.id, 
          role: profile.role, 
          tourKey, 
          hasCompletedTourLocal,
          hasCompletedTour
        });
        
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
  }, [user, profile, checkTourCompletionFromDB]);

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

  const endTour = useCallback(async () => {
    setIsActive(false);
    setCurrentStep(0);
    setCurrentTour([]);
    setShowWelcome(false);
    
    // Mark tour as completed
    if (user && profile && profile.role) {
      try {
        const tourType = profile.role;
        const tourKey = `tour_completed_${user.id}_${tourType}`;
        
        // Save to localStorage (immediate)
        localStorage.setItem(tourKey, 'true');
        
        // Save to database (async)
        const dbSuccess = await saveTourCompletionToDB(user.id, tourType);
        
        console.log('Tour completed and saved:', { 
          tourKey, 
          dbSuccess 
        });
      } catch (error) {
        console.error('Error saving tour completion:', error);
      }
    }
  }, [user, profile, saveTourCompletionToDB]);

  const skipTour = useCallback(async () => {
    setShowWelcome(false);
    
    // Mark tour as completed (skipped)
    if (user && profile && profile.role) {
      try {
        const tourType = profile.role;
        const tourKey = `tour_completed_${user.id}_${tourType}`;
        
        // Save to localStorage (immediate)
        localStorage.setItem(tourKey, 'true');
        
        // Save to database (async)
        const dbSuccess = await saveTourCompletionToDB(user.id, tourType);
        
        console.log('Tour skipped and saved:', { 
          tourKey, 
          dbSuccess 
        });
      } catch (error) {
        console.error('Error saving tour skip:', error);
      }
    }
  }, [user, profile, saveTourCompletionToDB]);

  const showTourPrompt = useCallback(() => {
    setShowWelcome(true);
  }, []);

  const hideTourPrompt = useCallback(() => {
    setShowWelcome(false);
  }, []);

  // Reset tour completion status (for testing/admin purposes)
  const resetTourCompletion = useCallback(async (userId?: string, tourType?: string) => {
    const targetUserId = userId || user?.id;
    const targetTourType = tourType || profile?.role;
    
    if (!targetUserId || !targetTourType) return false;
    
    try {
      const tourKey = `tour_completed_${targetUserId}_${targetTourType}`;
      
      // Remove from localStorage
      localStorage.removeItem(tourKey);
      
      // Remove from database
      const { error } = await supabase
        .from('tour_completion')
        .delete()
        .eq('user_id', targetUserId)
        .eq('tour_type', targetTourType);
      
      if (error) {
        console.error('Error resetting tour completion:', error);
        return false;
      }
      
      console.log('Tour completion reset:', { targetUserId, targetTourType });
      return true;
    } catch (error) {
      console.error('Error in resetTourCompletion:', error);
      return false;
    }
  }, [user, profile]);

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
    hideTourPrompt,
    resetTourCompletion
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