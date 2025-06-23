
// Get Stripe publishable key from environment variable
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Validate Stripe key is available
if (!STRIPE_PUBLISHABLE_KEY) {
  console.error('VITE_STRIPE_PUBLISHABLE_KEY environment variable is not set');
}

// Validate key format
if (STRIPE_PUBLISHABLE_KEY && !STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
  console.error('VITE_STRIPE_PUBLISHABLE_KEY must be a valid Stripe publishable key (starts with pk_)');
}
