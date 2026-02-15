// Stripe publishable key - should match the key type used in backend
// This key is safe to expose in the frontend
export const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51RYKULCh2vqPdjRSFfWUwkIXEAvYSPDyJlksHhqSHVOtNegnMd8eKUvO7IJLfBiLxmrd4yF2RoDgG0SgAN5o3baP00ZOcUZUGs";

// Validate Stripe configuration
export const validateStripeConfig = () => {
  const errors: string[] = [];

  if (!STRIPE_PUBLISHABLE_KEY) {
    errors.push("Stripe publishable key is not configured");
  }

  if (STRIPE_PUBLISHABLE_KEY && !STRIPE_PUBLISHABLE_KEY.startsWith("pk_")) {
    errors.push("Invalid Stripe publishable key format");
  }

  const isLiveKey = STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_");
  const isTestKey = STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_");

  if (!isLiveKey && !isTestKey) {
    errors.push("Stripe key must be either live or test key");
  }

  return {
    isValid: errors.length === 0,
    errors,
    keyType: isLiveKey ? "live" : isTestKey ? "test" : "unknown",
  };
};
