
// Get Stripe publishable key from environment variable
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_live_51RYKUCCrUPkotWKCM10E0EeqJ5j24WbloBt4CemrXYkJxsGUdS6Xxl5hsyh7UaIHBeI9nVtgqjmXI3sTD7xyvNnV00s1GO6it4';

// Validate Stripe key is available
if (!STRIPE_PUBLISHABLE_KEY) {
  console.error('VITE_STRIPE_PUBLISHABLE_KEY environment variable is not set');
}
