import React, { useEffect, useRef, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { STRIPE_CONFIG, validateStripeConfig } from '@/lib/stripe-config';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CreditCard, Calendar, Shield, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StripeCardTabbedElementProps {
  onReady: (stripe: any, elements: any, cardElements: { cardNumber: any; cardExpiry: any; cardCvc: any }) => void;
  onError: (error: string) => void;
}

export const StripeCardTabbedElement = ({ onReady, onError }: StripeCardTabbedElementProps) => {
  const cardNumberRef = useRef<HTMLDivElement>(null);
  const cardExpiryRef = useRef<HTMLDivElement>(null);
  const cardCvcRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [configError, setConfigError] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState('Initializing payment form...');
  const [activeTab, setActiveTab] = useState('cardNumber');
  
  // Field validation states
  const [fieldStates, setFieldStates] = useState({
    cardNumber: { complete: false, error: '' },
    cardExpiry: { complete: false, error: '' },
    cardCvc: { complete: false, error: '' },
  });
  
  const initializationRef = useRef(false);
  const mountedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 5;

  const waitForDomElements = async (maxAttempts = 10, interval = 100): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 DOM check attempt ${attempt}/${maxAttempts}`);
      
      if (!mountedRef.current) {
        console.log('❌ Component unmounted during DOM check');
        return false;
      }
      
      if (cardNumberRef.current?.isConnected && 
          cardExpiryRef.current?.isConnected && 
          cardCvcRef.current?.isConnected) {
        console.log('✅ All DOM elements found and connected');
        return true;
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    console.log('❌ DOM elements not found after all attempts');
    return false;
  };

  const updateFieldState = (field: keyof typeof fieldStates, complete: boolean, error: string) => {
    setFieldStates(prev => ({
      ...prev,
      [field]: { complete, error }
    }));
  };

  const autoAdvanceTab = (currentField: string) => {
    const currentState = fieldStates[currentField as keyof typeof fieldStates];
    if (currentState.complete && !currentState.error) {
      switch (currentField) {
        case 'cardNumber':
          setActiveTab('cardExpiry');
          break;
        case 'cardExpiry':
          setActiveTab('cardCvc');
          break;
        // CVC is the last field, no advancement needed
      }
    }
  };

  const initializeStripe = async () => {
    if (isInitialized || initializationRef.current || !mountedRef.current) {
      console.log('🔄 Skipping initialization - already in progress or component unmounted');
      return;
    }
    
    console.log('🚀 Starting Stripe tabbed initialization with key:', 
      STRIPE_CONFIG.publishableKey?.substring(0, 8) + '...');
    
    try {
      setIsLoading(true);
      setConfigError('');
      retryCountRef.current += 1;
      
      console.log(`🔄 Starting Stripe initialization attempt ${retryCountRef.current}...`);
      setLoadingMessage(`Initializing payment form... (attempt ${retryCountRef.current})`);
      
      // Validate configuration first
      const validation = validateStripeConfig();
      if (!validation.isValid) {
        console.error('❌ Stripe configuration invalid:', validation.errors);
        throw new Error(validation.errors[0]);
      }
      
      console.log('✅ Stripe configuration valid, loading Stripe.js...');
      
      // Wait for DOM elements to be ready
      console.log('🔄 Waiting for DOM elements...');
      setLoadingMessage('Preparing payment form container...');
      
      const domReady = await waitForDomElements(15, 200);
      if (!domReady) {
        throw new Error('Payment form containers could not be initialized. Please refresh the page and try again.');
      }

      if (!mountedRef.current) {
        console.log('❌ Component unmounted during DOM wait');
        return;
      }

      initializationRef.current = true;
      setLoadingMessage('Loading Stripe payment system...');

      const stripe: Stripe | null = await loadStripe(STRIPE_CONFIG.publishableKey);

      if (!stripe) {
        throw new Error('Failed to load Stripe.js - check your internet connection');
      }

      if (!mountedRef.current) {
        console.log('❌ Component unmounted after Stripe load');
        return;
      }

      console.log('✅ Stripe.js loaded successfully, creating elements...');
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

      // Create individual elements
      const cardNumberElement = elements.create('cardNumber', {
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
      });

      const cardExpiryElement = elements.create('cardExpiry', {
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
      });

      const cardCvcElement = elements.create('cardCvc', {
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
      });

      // Final check before mounting
      if (!mountedRef.current || !cardNumberRef.current || !cardExpiryRef.current || !cardCvcRef.current) {
        console.log('❌ Component or element refs not available for mounting');
        return;
      }

      console.log('🔄 Mounting card elements...');
      setLoadingMessage('Finalizing payment form...');
      
      await Promise.all([
        cardNumberElement.mount(cardNumberRef.current),
        cardExpiryElement.mount(cardExpiryRef.current),
        cardCvcElement.mount(cardCvcRef.current),
      ]);
      
      if (!mountedRef.current) {
        console.log('❌ Component unmounted after mount');
        return;
      }

      setIsInitialized(true);
      retryCountRef.current = 0;
      console.log('✅ All card elements mounted successfully');

      // Set up event listeners for each element
      const setupElementEvents = (element: any, fieldName: string) => {
        element.on('change', ({ error, complete }: any) => {
          if (!mountedRef.current) return;
          
          let userFriendlyError = '';
          if (error) {
            console.error(`❌ Stripe ${fieldName} validation error:`, error);
            
            // Improve error messages for card input
            if (error.code === 'incomplete_number') {
              userFriendlyError = 'Please enter a complete card number';
            } else if (error.code === 'incomplete_expiry') {
              userFriendlyError = 'Please enter a valid expiry date';
            } else if (error.code === 'incomplete_cvc') {
              userFriendlyError = 'Please enter a valid security code (CVC)';
            } else if (error.code === 'invalid_number') {
              userFriendlyError = 'Please enter a valid card number';
            } else {
              userFriendlyError = error.message;
            }
          }
          
          updateFieldState(fieldName as keyof typeof fieldStates, complete, userFriendlyError);
          
          if (complete && !error) {
            console.log(`✅ ${fieldName} validation successful`);
            autoAdvanceTab(fieldName);
          }
          
          // Update global error state
          const hasAnyError = Object.values(fieldStates).some(state => state.error) || userFriendlyError;
          if (hasAnyError) {
            onError(userFriendlyError || Object.values(fieldStates).find(state => state.error)?.error || '');
          } else {
            onError('');
          }
        });

        element.on('ready', () => {
          if (!mountedRef.current) return;
          console.log(`✅ Stripe ${fieldName} element is ready for input`);
        });
      };

      setupElementEvents(cardNumberElement, 'cardNumber');
      setupElementEvents(cardExpiryElement, 'cardExpiry');
      setupElementEvents(cardCvcElement, 'cardCvc');

      onReady(stripe, elements, {
        cardNumber: cardNumberElement,
        cardExpiry: cardExpiryElement,
        cardCvc: cardCvcElement,
      });
      
      setIsLoading(false);
      console.log('✅ Stripe tabbed initialization complete');

    } catch (error: any) {
      console.error('❌ Stripe initialization error:', error);
      initializationRef.current = false;
      
      if (!mountedRef.current) return;

      setIsLoading(false);
      
      let errorMessage = 'Failed to initialize payment form. ';
      
      if (retryCountRef.current < maxRetries && 
          (error.message.includes('container') || error.message.includes('DOM'))) {
        // Auto-retry for container/DOM issues
        console.log(`🔄 Auto-retrying initialization (attempt ${retryCountRef.current + 1}/${maxRetries})`);
        setTimeout(() => {
          if (mountedRef.current) {
            initializeStripe();
          }
        }, 1000);
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
    console.log('🔄 StripeCardTabbedElement mounted, starting initialization...');
    
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        initializeStripe();
      }
    }, 300);
    
    return () => {
      console.log('🔄 StripeCardTabbedElement unmounting...');
      mountedRef.current = false;
      clearTimeout(timer);
      initializationRef.current = false;
      retryCountRef.current = 0;
    };
  }, []);

  const handleRetry = () => {
    console.log('🔄 Manual retry triggered');
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
      <div className="p-4 border rounded-md bg-gray-50 min-h-[200px] flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-sm text-gray-600">{loadingMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger 
            value="cardNumber" 
            className={cn(
              "flex items-center space-x-2",
              fieldStates.cardNumber.complete && "text-green-600"
            )}
          >
            <CreditCard className="h-4 w-4" />
            <span>Card Number</span>
            {fieldStates.cardNumber.complete && <Check className="h-3 w-3" />}
          </TabsTrigger>
          <TabsTrigger 
            value="cardExpiry"
            className={cn(
              "flex items-center space-x-2",
              fieldStates.cardExpiry.complete && "text-green-600"
            )}
          >
            <Calendar className="h-4 w-4" />
            <span>Expiry</span>
            {fieldStates.cardExpiry.complete && <Check className="h-3 w-3" />}
          </TabsTrigger>
          <TabsTrigger 
            value="cardCvc"
            className={cn(
              "flex items-center space-x-2",
              fieldStates.cardCvc.complete && "text-green-600"
            )}
          >
            <Shield className="h-4 w-4" />
            <span>CVC</span>
            {fieldStates.cardCvc.complete && <Check className="h-3 w-3" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cardNumber" className="space-y-2">
          <div 
            ref={cardNumberRef} 
            className="p-4 border border-gray-300 rounded-md bg-white min-h-[52px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
          />
          {fieldStates.cardNumber.error && (
            <div className="text-red-600 text-xs">{fieldStates.cardNumber.error}</div>
          )}
          <p className="text-xs text-gray-500">
            Enter your 16-digit card number
          </p>
        </TabsContent>

        <TabsContent value="cardExpiry" className="space-y-2">
          <div 
            ref={cardExpiryRef} 
            className="p-4 border border-gray-300 rounded-md bg-white min-h-[52px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
          />
          {fieldStates.cardExpiry.error && (
            <div className="text-red-600 text-xs">{fieldStates.cardExpiry.error}</div>
          )}
          <p className="text-xs text-gray-500">
            Enter your card's expiry date (MM/YY)
          </p>
        </TabsContent>

        <TabsContent value="cardCvc" className="space-y-2">
          <div 
            ref={cardCvcRef} 
            className="p-4 border border-gray-300 rounded-md bg-white min-h-[52px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
          />
          {fieldStates.cardCvc.error && (
            <div className="text-red-600 text-xs">{fieldStates.cardCvc.error}</div>
          )}
          <p className="text-xs text-gray-500">
            Enter the 3-digit security code on the back of your card
          </p>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-gray-500">
        Your payment will be authorized but not charged until service completion.
      </p>
    </div>
  );
};