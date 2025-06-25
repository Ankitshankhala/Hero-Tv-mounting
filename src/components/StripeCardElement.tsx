
import React, { useEffect, useRef, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { STRIPE_CONFIG, validateStripeConfig } from '@/lib/stripe-config';

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

  const initializeStripe = async () => {
    if (isInitialized || initializationRef.current || !mountedRef.current) return;
    
    try {
      setIsLoading(true);
      setConfigError('');
      console.log('🔄 Starting Stripe initialization...');
      
      // Validate configuration first
      const validation = validateStripeConfig();
      if (!validation.isValid) {
        console.error('❌ Stripe configuration invalid:', validation.errors);
        throw new Error(validation.errors[0]);
      }
      
      console.log('✅ Stripe configuration valid, loading Stripe.js...');
      
      // Wait for DOM element to be ready
      if (!cardElementRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!cardElementRef.current && mountedRef.current) {
          throw new Error('Payment form container not found');
        }
      }

      initializationRef.current = true;

      const stripe: Stripe | null = await loadStripe(STRIPE_CONFIG.publishableKey);

      if (!stripe) {
        throw new Error('Failed to load Stripe.js - check your internet connection');
      }

      if (!mountedRef.current) return;

      console.log('✅ Stripe.js loaded successfully, creating elements...');

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

      console.log('🔄 Mounting card element...');
      await cardElement.mount(cardElementRef.current);
      
      if (!mountedRef.current) return;

      setIsInitialized(true);
      console.log('✅ Card element mounted successfully');

      cardElement.on('change', ({ error, complete }: any) => {
        if (!mountedRef.current) return;
        
        if (error) {
          console.error('❌ Stripe card error:', error);
          onError(error.message);
        } else if (complete) {
          console.log('✅ Card input complete');
          onError(''); // Clear any previous errors
        }
      });

      cardElement.on('ready', () => {
        if (!mountedRef.current) return;
        console.log('✅ Stripe card element is ready for input');
      });

      onReady(stripe, elements, cardElement);
      setIsLoading(false);
      console.log('✅ Stripe initialization complete');

    } catch (error: any) {
      console.error('❌ Stripe initialization error:', error);
      initializationRef.current = false;
      
      if (!mountedRef.current) return;

      setIsLoading(false);
      
      let errorMessage = 'Failed to initialize payment form. ';
      if (error.message.includes('configuration') || error.message.includes('key')) {
        errorMessage += 'Please check your Stripe configuration.';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage += 'Please check your internet connection and try again.';
      } else {
        errorMessage += error.message || 'Please refresh the page and try again.';
      }
      
      setConfigError(errorMessage);
      onError(errorMessage);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        initializeStripe();
      }
    }, 100);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  const handleRetry = () => {
    setConfigError('');
    setIsLoading(true);
    setIsInitialized(false);
    initializationRef.current = false;
    setLoadingMessage('Retrying initialization...');
    
    setTimeout(() => {
      if (mountedRef.current) {
        initializeStripe();
      }
    }, 500);
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
      />
      <p className="text-xs text-gray-500">
        Enter your card details. Your payment will be authorized but not charged until service completion.
      </p>
    </div>
  );
};
