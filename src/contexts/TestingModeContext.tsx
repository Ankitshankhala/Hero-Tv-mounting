import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TestingModeContextType {
  isTestingMode: boolean;
  timeRemaining: number;
  activateTestingMode: () => void;
  deactivateTestingMode: () => void;
}

const TestingModeContext = createContext<TestingModeContextType | undefined>(undefined);

const TESTING_MODE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const STORAGE_KEY = 'testing_mode_expiry';

export const TestingModeProvider = ({ children }: { children: ReactNode }) => {
  const [isTestingMode, setIsTestingMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    // Check if testing mode is active on mount
    const expiryString = localStorage.getItem(STORAGE_KEY);
    if (expiryString) {
      const expiry = parseInt(expiryString);
      const now = Date.now();
      
      if (now < expiry) {
        setIsTestingMode(true);
        setTimeRemaining(Math.ceil((expiry - now) / 1000));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTestingMode && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsTestingMode(false);
            localStorage.removeItem(STORAGE_KEY);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTestingMode, timeRemaining]);

  const activateTestingMode = () => {
    const expiry = Date.now() + TESTING_MODE_DURATION;
    localStorage.setItem(STORAGE_KEY, expiry.toString());
    setIsTestingMode(true);
    setTimeRemaining(TESTING_MODE_DURATION / 1000);
  };

  const deactivateTestingMode = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsTestingMode(false);
    setTimeRemaining(0);
  };

  return (
    <TestingModeContext.Provider value={{
      isTestingMode,
      timeRemaining,
      activateTestingMode,
      deactivateTestingMode
    }}>
      {children}
    </TestingModeContext.Provider>
  );
};

export const useTestingMode = () => {
  const context = useContext(TestingModeContext);
  if (context === undefined) {
    throw new Error('useTestingMode must be used within a TestingModeProvider');
  }
  return context;
};

export const getEffectiveMinimumAmount = (isTestingMode: boolean) => {
  return isTestingMode ? 1 : 75;
};

export const getEffectiveServicePrice = (originalPrice: number, isTestingMode: boolean) => {
  return isTestingMode ? 1 : originalPrice;
};