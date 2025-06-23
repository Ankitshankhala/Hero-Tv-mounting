
import React, { useEffect, useRef, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { STRIPE_CONFIG, validateStripeConfig } from '@/lib/stripe-config';
import { useErrorMonitoring } from '@/hooks/useErrorMonitoring';

interface StripeCardElementProps {
  onReady: (stripe: any, elements: any, cardElement: any) => void;
  onError: (error: string) => void;
}

export const StripeCardElement = ({ onReady, onError }: StripeCardElementProps) => {
  const cardElementRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [configError, setConfigError] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState('Initializing payment form...');
  const initializationRef = useRef(false);
  const mountedRef = useRef(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const { logStripeError } = useErrorMonitoring();

  const MAX_AUTO_RETRIES = 2;

  // Cleanup function
  const cleanup = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  // Simplified DOM element readiness check - much less strict
  const isDOMElementReady = (element: HTMLElement | null): boolean => {
    if (!element) return false;
    
    // Only check if element exists and is connected to DOM
    return element.isConnected;
  };

  const initializeStripe = async () => {
    if (isInitialized || initializationRef.current || !mountedRef.current) return;
    
    try {
      setIsLoading(true);
      setConfigError('');
      setLoadingMessage(autoRetryCount > 0 ? 
        `Retrying initialization... (${autoRetryCount + 1}/${MAX_AUTO_RETRIES + 1})` : 
        'Initializing payment form...'
      );
      
      console.log(`Starting Stripe initialization... (attempt ${autoRetryCount + 1})`);
      
      // Simple check - just ensure element exists and is connected
      if (!cardElementRef.current || !isDOMElementReady(cardElementRef.current)) {
        // Wait a bit for DOM to be ready, then try anyway
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!cardElementRef.current && mountedRef.current) {
          throw new Error('Payment form container not found. Please refresh the page.');
        }
      }

      initializationRef.current = true;

      const stripe: Stripe | null = await loadStripe(STRIPE_CONFIG.publishableKey);

      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      if (!mountedRef.current) return;

      console.log('Stripe loaded successfully, creating elements...');

      const elements = stripe.elements({
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#2563eb',
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            fontFamily: 'system-ui, sans-serif',
          },
        },
      });

      const cardElement = elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'system-ui, sans-serif',
            '::placeholder': {
              color: '#6b7280',
            },
          },
          invalid: {
            color: '#ef4444',
          },
        },
        hidePostalCode: true,
      });

      if (!mountedRef.current || !cardElementRef.current) return;

      console.log('Mounting card element...');
      await cardElement.mount(cardElementRef.current);
      
      if (!mountedRef.current) return;

      setIsInitialized(true);
      console.log('Card element mounted successfully');

      cardElement.on('change', ({ error, complete }: any) => {
        if (!mountedRef.current) return;
        
        if (error) {
          console.error('Stripe card error:', error);
          logStripeError(error, 'card element change', {
            errorType: error.type,
            errorCode: error.code
          });
          onError(error.message);
        } else if (complete) {
          onError(''); // Clear any previous errors
        }
      });

      cardElement.on('ready', () => {
        if (!mountedRef.current) return;
        console.log('Stripe card element is ready for input');
      });

      onReady(stripe, elements, cardElement);
      setIsLoading(false);
      setAutoRetryCount(0); // Reset retry count on success
      console.log('Stripe initialization complete');
    } catch (error: any) {
      console.error('Stripe initialization error:', error);
      logStripeError(error, 'initialization', {
        stripeKey: STRIPE_CONFIG.publishableKey ? 'present' : 'missing',
        errorDetails: error.message,
        autoRetryCount
      });
      
      initializationRef.current = false; // Allow retry
      
      if (!mountedRef.current) return;

      // Attempt automatic retry with exponential backoff - but limit retries
      if (autoRetryCount < MAX_AUTO_RETRIES) {
        const nextRetryCount = autoRetryCount + 1;
        const retryDelay = 1000 * Math.pow(2, autoRetryCount); // 1s, 2s, 4s
        
        setAutoRetryCount(nextRetryCount);
        
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            initializeStripe();
          }
        }, retryDelay);
        
        return;
      }
      
      // All retries exhausted, show error
      setIsLoading(false);
      
      let errorMessage = 'Failed to initialize payment form. ';
      if (error.message.includes('container not')) {
        errorMessage += 'Please refresh the page and try again.';
      } else if (error.message.includes('key') || error.message.includes('publishable')) {
        errorMessage += 'Payment system configuration error. Please contact support.';
      } else {
        errorMessage += 'Please check your internet connection and try again.';
      }
      
      setConfigError(errorMessage);
      onError(errorMessage);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Validate configuration first
    const validation = validateStripeConfig();
    if (!validation.isValid) {
      setConfigError(validation.errors[0]);
      setIsLoading(false);
      onError(validation.errors[0]);
      return;
    }

    // Start initialization with a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        initializeStripe();
      }
    }, 100);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      cleanup();
    };
  }, [onReady, onError, logStripeError]);

  const handleManualRetry = () => {
    cleanup();
    setConfigError('');
    setIsLoading(true);
    setIsInitialized(false);
    setAutoRetryCount(0);
    initializationRef.current = false;
    setLoadingMessage('Initializing payment form...');
    
    // Small delay before retry to ensure clean state
    setTimeout(() => {
      if (mountedRef.current) {
        initializeStripe();
      }
    }, 200);
  };

  if (configError) {
    return (
      <div className="p-4 border border-red-300 rounded-md bg-red-50">
        <div className="flex items-center space-x-2">
          <div className="text-red-600 text-sm font-medium">Payment Configuration Error</div>
        </div>
        <div className="text-red-600 text-sm mt-1">{configError}</div>
        <button 
          onClick={handleManualRetry}
          className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 border rounded-md bg-gray-50 min-h-[52px] flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-sm text-gray-600">{loadingMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div 
        ref={cardElementRef} 
        className="p-4 border border-gray-300 rounded-md bg-white min-h-[52px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
      />
      <p className="text-xs text-gray-500">
        Enter your card details. Your payment will be authorized but not charged until service completion.
      </p>
    </div>
  );
};
