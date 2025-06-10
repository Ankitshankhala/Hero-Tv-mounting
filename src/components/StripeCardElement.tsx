
import React, { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/stripe';

interface StripeCardElementProps {
  onReady: (stripe: any, elements: any, cardElement: any) => void;
  onError: (error: string) => void;
}

export const StripeCardElement = ({ onReady, onError }: StripeCardElementProps) => {
  const cardElementRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationRef = useRef(false);

  useEffect(() => {
    if (isInitialized || initializationRef.current) return;
    initializationRef.current = true;

    const initializeStripe = async () => {
      try {
        setIsLoading(true);
        
        console.log('Starting Stripe initialization...');
        
        // Create a timeout promise that rejects after 10 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Stripe initialization timeout')), 10000);
        });

        // Race between loadStripe and timeout
        const stripe = await Promise.race([
          loadStripe(STRIPE_PUBLISHABLE_KEY),
          timeoutPromise
        ]);

        if (!stripe) {
          throw new Error('Failed to load Stripe');
        }

        console.log('Stripe loaded successfully, creating elements...');

        const elements = stripe.elements();
        const cardElement = elements.create('card', {
          style: {
            base: {
              fontSize: '16px',
              color: '#424770',
              '::placeholder': {
                color: '#aab7c4',
              },
            },
          },
        });

        if (cardElementRef.current) {
          console.log('Mounting card element...');
          await cardElement.mount(cardElementRef.current);
          setIsInitialized(true);
          console.log('Card element mounted, calling onReady...');
          onReady(stripe, elements, cardElement);
        }

        cardElement.on('change', ({ error }: any) => {
          if (error) {
            console.error('Stripe card error:', error);
            onError(error.message);
          } else {
            onError('');
          }
        });

        setIsLoading(false);
        console.log('Stripe initialization complete');
      } catch (error) {
        console.error('Stripe initialization error:', error);
        setIsLoading(false);
        initializationRef.current = false; // Allow retry
        
        if (error.message.includes('timeout')) {
          onError('Payment form is taking too long to load. Please refresh and try again.');
        } else {
          onError('Failed to initialize payment form. Please check your internet connection and try again.');
        }
      }
    };

    // Add a small delay to prevent immediate execution
    const timer = setTimeout(initializeStripe, 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, [onReady, onError, isInitialized]);

  if (isLoading) {
    return (
      <div className="p-3 border rounded-md bg-gray-50 min-h-[44px] flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-sm text-gray-500">Loading secure payment form...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={cardElementRef} 
      className="p-3 border rounded-md bg-white min-h-[44px] flex items-center"
    />
  );
};
