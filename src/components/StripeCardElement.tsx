
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

  useEffect(() => {
    if (isInitialized) return; // Prevent multiple initializations

    const initializeStripe = async () => {
      try {
        setIsLoading(true);
        
        console.log('Initializing Stripe with key:', STRIPE_PUBLISHABLE_KEY?.substring(0, 20) + '...');
        
        const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
        if (!stripe) {
          throw new Error('Failed to load Stripe');
        }

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
          cardElement.mount(cardElementRef.current);
          setIsInitialized(true);
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
      } catch (error) {
        console.error('Stripe initialization error:', error);
        setIsLoading(false);
        onError('Failed to initialize Stripe payment form');
      }
    };

    initializeStripe();
  }, [onReady, onError, isInitialized]);

  if (isLoading) {
    return (
      <div className="p-3 border rounded-md bg-gray-50 min-h-[44px] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading payment form...</div>
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
