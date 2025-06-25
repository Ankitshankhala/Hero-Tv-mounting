
// Stripe configuration with proper validation
export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD
};

// Validate Stripe configuration
export const validateStripeConfig = () => {
  const errors: string[] = [];

  if (!STRIPE_CONFIG.publishableKey) {
    errors.push('Stripe publishable key is not configured. Please check your environment variables.');
  }

  if (STRIPE_CONFIG.publishableKey && !STRIPE_CONFIG.publishableKey.startsWith('pk_')) {
    errors.push('Invalid Stripe publishable key format. Key must start with pk_');
  }

  // Additional validation for live vs test keys
  if (STRIPE_CONFIG.publishableKey) {
    const isLiveKey = STRIPE_CONFIG.publishableKey.startsWith('pk_live_');
    const isTestKey = STRIPE_CONFIG.publishableKey.startsWith('pk_test_');
    
    if (!isLiveKey && !isTestKey) {
      errors.push('Stripe key must be either a live key (pk_live_) or test key (pk_test_)');
    }
    
    if (STRIPE_CONFIG.isProduction && isTestKey) {
      console.warn('WARNING: Using test Stripe key in production environment');
    }
  }

  if (errors.length > 0) {
    console.error('Stripe configuration errors:', errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    keyType: STRIPE_CONFIG.publishableKey?.startsWith('pk_live_') ? 'live' : 'test'
  };
};

// Initialize and log validation results
const validationResult = validateStripeConfig();
console.log('Stripe Configuration Status:', {
  isValid: validationResult.isValid,
  keyType: validationResult.keyType,
  errors: validationResult.errors
});

export { validationResult as stripeValidation };
