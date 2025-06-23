
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
    errors.push('VITE_STRIPE_PUBLISHABLE_KEY environment variable is required');
  }

  if (STRIPE_CONFIG.publishableKey && !STRIPE_CONFIG.publishableKey.startsWith('pk_')) {
    errors.push('VITE_STRIPE_PUBLISHABLE_KEY must be a valid Stripe publishable key (starts with pk_)');
  }

  if (errors.length > 0) {
    console.error('Stripe configuration errors:', errors);
    if (STRIPE_CONFIG.isProduction) {
      throw new Error(`Stripe configuration errors: ${errors.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Initialize validation
const validationResult = validateStripeConfig();
if (!validationResult.isValid) {
  console.warn('Stripe configuration issues detected:', validationResult.errors);
}

export { validationResult as stripeValidation };
