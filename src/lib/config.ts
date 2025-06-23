
// Environment configuration and validation
export const config = {
  stripe: {
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD
};

// Validate required environment variables
export const validateConfig = () => {
  const errors: string[] = [];

  if (!config.stripe.publishableKey) {
    errors.push('VITE_STRIPE_PUBLISHABLE_KEY is required');
  }

  if (config.stripe.publishableKey && !config.stripe.publishableKey.startsWith('pk_')) {
    errors.push('VITE_STRIPE_PUBLISHABLE_KEY must be a valid Stripe publishable key');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:', errors);
    if (config.isProduction) {
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }
  }

  return errors.length === 0;
};

// Initialize config validation
validateConfig();
