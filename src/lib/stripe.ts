// Stripe publishable key - should match the key type used in backend
// This key is safe to expose in the frontend
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RYKUCCrUPkotWKCM10E0EeqJ5j24WbloBt4CemrXYkJxsGUdS6Xxl5hsyh7UaIHBeI9nVtgqjmXI3sTD7xyvNnV00s1GO6it4';

// Validate Stripe configuration
export const validateStripeConfig = () => {
  const errors: string[] = [];
  
  if (!STRIPE_PUBLISHABLE_KEY) {
    errors.push('Stripe publishable key is not configured');
  }
  
  if (STRIPE_PUBLISHABLE_KEY && !STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
    errors.push('Invalid Stripe publishable key format');
  }
  
  const isLiveKey = STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_');
  const isTestKey = STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_');
  
  if (!isLiveKey && !isTestKey) {
    errors.push('Stripe key must be either live or test key');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    keyType: isLiveKey ? 'live' : isTestKey ? 'test' : 'unknown'
  };
};
