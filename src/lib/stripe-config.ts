
// Stripe configuration with proper validation
export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "",
  isDevelopment: false,
  isProduction: true
};

// 🚨 TO SWITCH TO LIVE STRIPE KEYS FOR TESTING:
// 1. Update .env file: VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
// 2. Update Supabase secrets: STRIPE_SECRET_KEY=sk_live_...
// 3. Activate testing mode in admin dashboard for $1 minimum testing

// Log configuration for debugging
console.log('🔧 Stripe Configuration:', {
  hasPublishableKey: !!STRIPE_CONFIG.publishableKey,
  keyType: STRIPE_CONFIG.publishableKey?.substring(0, 8) + '...',
  environment: STRIPE_CONFIG.isProduction ? 'production' : 'development'
});

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
console.log('✅ Stripe Configuration Status:', {
  isValid: validationResult.isValid,
  keyType: validationResult.keyType,
  errors: validationResult.errors
});

// Environment key matching check
if (STRIPE_CONFIG.publishableKey) {
  const isLiveKey = STRIPE_CONFIG.publishableKey.startsWith('pk_live_');
  const isTestKey = STRIPE_CONFIG.publishableKey.startsWith('pk_test_');
  
  console.log('🔑 Key Environment Check:', {
    publishableKeyType: isLiveKey ? 'LIVE' : isTestKey ? 'TEST' : 'UNKNOWN',
    shouldMatchSecretKey: 'Ensure your STRIPE_SECRET_KEY in Supabase matches this environment'
  });
}

export { validationResult as stripeValidation };
