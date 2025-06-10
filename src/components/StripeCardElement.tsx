
import React, { useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/stripe';

interface StripeCardElementProps {
  onReady: (stripe: any, elements: any, cardElement: any) => void;
  onError: (error: string) => void;
}

export const StripeCardElement = ({ onReady, onError }: StripeCardElementProps) => {
  const cardElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
        if (!stripe) {
          onError('Failed to load Stripe');
          return;
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
          onReady(stripe, elements, cardElement);
        }

        cardElement.on('change', ({ error }: any) => {
          if (error) {
            onError(error.message);
          } else {
            onError('');
          }
        });
      } catch (error) {
        onError('Failed to initialize Stripe');
      }
    };

    initializeStripe();
  }, [onReady, onError]);

  return (
    <div 
      ref={cardElementRef} 
      className="p-3 border rounded-md bg-white min-h-[44px] flex items-center"
    />
  );
};
</StripeCardElement>
