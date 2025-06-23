
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
  const initializationRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const { logStripeError } = useErrorMonitoring();

  const initializeStripe = async () => {
    if (isInitialized || initializationRef.current) return;
    
    try {
      setIsLoading(true);
      setConfigError('');
      
      console.log('Starting Stripe initialization...');
      
      // Wait for the DOM element to be available with multiple checks
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!cardElementRef.current && attempts < maxAttempts) {
        console.log(`Waiting for DOM element... attempt ${attempts + 1}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!cardElementRef.current) {
        throw new Error('Payment form container not ready after waiting. Please try again.');
      }

      initializationRef.current = true;

      const stripe: Stripe | null = await loadStripe(STRIPE_CONFIG.publishableKey);

      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

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

      console.log('Mounting card element...');
      await cardElement.mount(cardElementRef.current);
      setIsInitialized(true);
      console.log('Card element mounted successfully');

      cardElement.on('change', ({ error, complete }: any) => {
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
        console.log('Stripe card element is ready for input');
      });

      onReady(stripe, elements, cardElement);
      setIsLoading(false);
      console.log('Stripe initialization complete');
    } catch (error: any) {
      console.error('Stripe initialization error:', error);
      logStripeError(error, 'initialization', {
        stripeKey: STRIPE_CONFIG.publishableKey ? 'present' : 'missing',
        errorDetails: error.message,
        retryCount
      });
      setIsLoading(false);
      initializationRef.current = false; // Allow retry
      
      let errorMessage = 'Failed to initialize payment form. ';
      if (error.message.includes('container not ready')) {
        errorMessage += 'Payment form container not ready. Please try again.';
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
    // Validate configuration first
    const validation = validateStripeConfig();
    if (!validation.isValid) {
      setConfigError(validation.errors[0]);
      setIsLoading(false);
      onError(validation.errors[0]);
      return;
    }

    // Use a longer initial delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeStripe();
    }, 1000);
    
    return () => {
      clearTimeout(timer);
    };
  }, [onReady, onError, logStripeError, retryCount]);

  const handleRetry = () => {
    setConfigError('');
    setIsLoading(true);
    setIsInitialized(false);
    initializationRef.current = false;
    setRetryCount(prev => prev + 1);
  };

  if (configError) {
    return (
      <div className="p-4 border border-red-300 rounded-md bg-red-50">
        <div className="flex items-center space-x-2">
          <div className="text-red-600 text-sm font-medium">Payment Configuration Error</div>
        </div>
        <div className="text-red-600 text-sm mt-1">{configError}</div>
        <button 
          onClick={handleRetry}
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
          <div className="text-sm text-gray-600">Loading secure payment form...</div>
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
