import React, { useEffect, useRef, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { STRIPE_PUBLISHABLE_KEY, validateStripeConfig } from '@/lib/stripe';

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
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const waitForDomElement = async (maxAttempts = 3, interval = 100): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!mountedRef.current) return false;
      
      if (cardElementRef.current && cardElementRef.current.isConnected) {
        return true;
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    return false;
  };

  const resetCardElement = async () => {
    console.log('Resetting card element...');
    
    // Unmount existing card element
    if (cardElementRef.current) {
      try {
        cardElementRef.current.unmount();
      } catch (e) {
        console.log('Card element already unmounted');
      }
    }
    
    // Clear all state
    setIsInitialized(false);
    initializationRef.current = false;
    setCardError('');
    setError(null);
    cardElementRef.current = null;
    
    // Reinitialize
    await initializeStripe();
  };

  useImperativeHandle(ref, () => ({
    reset: resetCardElement
  }));

  const initializeStripe = async () => {
    if (isInitialized || initializationRef.current || !mountedRef.current) {
      return;
    }
    
    try {
      setIsLoading(true);
      setConfigError('');
      retryCountRef.current += 1;
      
      setLoadingMessage(`Initializing payment form...`);
      
      // Validate configuration first
      const validation = validateStripeConfig();
      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }
      
      // Wait for DOM element to be ready
      setLoadingMessage('Preparing payment form...');
      
      const domReady = await waitForDomElement(3, 100);
      if (!domReady) {
        throw new Error('Payment form container could not be initialized.');
      }

      if (!mountedRef.current) return;

      initializationRef.current = true;
      setLoadingMessage('Loading payment system...');

      const stripe: Stripe | null = await loadStripe(STRIPE_PUBLISHABLE_KEY);

      if (!stripe || !mountedRef.current) {
        throw new Error('Failed to load Stripe.js');
      }

      setLoadingMessage('Setting up payment form...');

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

      // Final check before mounting
      if (!mountedRef.current || !cardElementRef.current) return;
      
      await cardElement.mount(cardElementRef.current);
      
      if (!mountedRef.current) return;

      setIsInitialized(true);
      retryCountRef.current = 0;

      cardElement.on('change', ({ error, complete }: any) => {
        if (!mountedRef.current) return;
        
        if (error) {
          // Improve error messages for card input
          let userFriendlyError = error.message;
          if (error.code === 'incomplete_number') {
            userFriendlyError = 'Please enter a complete card number';
          } else if (error.code === 'incomplete_expiry') {
            userFriendlyError = 'Please enter a valid expiry date (MM/YY)';
          } else if (error.code === 'incomplete_cvc') {
            userFriendlyError = 'Please enter a valid security code (CVC)';
          } else if (error.code === 'invalid_number') {
            userFriendlyError = 'Please enter a valid card number';
          } else if (error.code === 'invalid_expiry_year_past') {
            userFriendlyError = 'Your card\'s expiration year is in the past';
          } else if (error.code === 'invalid_expiry_month_past') {
            userFriendlyError = 'Your card\'s expiration month is in the past';
          }
          
          onError(userFriendlyError);
        } else if (complete) {
          onError(''); // Clear any previous errors - successful state
        } else {
          onError(''); // Clear errors while user is typing
        }
      });

      cardElement.on('ready', () => {
        if (mountedRef.current) {
          onReady(stripe, elements, cardElement);
          setIsLoading(false);
        }
      });

    } catch (error: any) {
      initializationRef.current = false;
      
      if (!mountedRef.current) return;

      setIsLoading(false);
      
      let errorMessage = 'Failed to initialize payment form. ';
      
      if (retryCountRef.current < maxRetries && 
          (error.message.includes('container') || error.message.includes('DOM'))) {
        // Auto-retry for container/DOM issues
        setTimeout(() => {
          if (mountedRef.current) {
            initializeStripe();
          }
        }, 500);
        return;
      }
      
      if (error.message.includes('configuration') || error.message.includes('key')) {
        errorMessage += 'Please check your Stripe configuration.';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage += 'Please check your internet connection and try again.';
      } else if (error.message.includes('container')) {
        errorMessage += 'Payment form setup failed. Please refresh the page.';
      } else {
        errorMessage += error.message || 'Please refresh the page and try again.';
      }
      
      setConfigError(errorMessage);
      onError(errorMessage);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Reduced delay for faster initialization
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        initializeStripe();
      }
    }, 100);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      initializationRef.current = false;
      retryCountRef.current = 0;
    };
  }, []);

  const handleRetry = () => {
    setConfigError('');
    setIsLoading(true);
    setIsInitialized(false);
    initializationRef.current = false;
    retryCountRef.current = 0;
    setLoadingMessage('Retrying initialization...');
    
    setTimeout(() => {
      if (mountedRef.current) {
        initializeStripe();
      }
    }, 300);
  };

  if (configError) {
    return (
      <div className="p-4 border border-red-300 rounded-md bg-red-50">
        <div className="flex items-center space-x-2">
          <div className="text-red-600 text-sm font-medium">Payment Setup Error</div>
        </div>
        <div className="text-red-600 text-sm mt-1">{configError}</div>
        <button 
          onClick={handleRetry}
          className="mt-2 text-sm text-red-700 hover:text-red-800 underline focus:outline-none"
        >
          Retry Setup
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
        style={{ minHeight: '52px' }}
      />
      <p className="text-xs text-gray-500">
        Enter your card details. Your payment will be authorized but not charged until service completion.
      </p>
    </div>
  );
};