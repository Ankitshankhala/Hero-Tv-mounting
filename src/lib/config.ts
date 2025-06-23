
// Environment configuration and validation
export const config = {
  stripe: {
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_live_51RYKUCCrUPkotWKCM10E0EeqJ5j24WbloBt4CemrXYkJxsGUdS6Xxl5hsyh7UaIHBeI9nVtgqjmXI3sTD7xyvNnV00s1GO6it4'
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
