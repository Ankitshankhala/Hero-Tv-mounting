// Stripe configuration with test/live mode toggle.
//
// Switching modes is controlled by VITE_STRIPE_MODE in .env:
//   VITE_STRIPE_MODE="live"  -> uses VITE_STRIPE_PUBLISHABLE_KEY
//   VITE_STRIPE_MODE="test"  -> uses VITE_STRIPE_PUBLISHABLE_KEY_TEST
//
// Default is "live" so production is never accidentally affected if the
// flag is missing.

const RAW_MODE = (import.meta.env.VITE_STRIPE_MODE ?? "live")
  .toString()
  .toLowerCase()
  .trim();

export const STRIPE_MODE: "test" | "live" =
  RAW_MODE === "test" ? "test" : "live";

const LIVE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";
const TEST_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST ?? "";

// The publishable key matching the active mode. Safe to expose in the frontend.
export const STRIPE_PUBLISHABLE_KEY: string =
  STRIPE_MODE === "test" ? TEST_KEY : LIVE_KEY;

// Validate Stripe configuration
export const validateStripeConfig = () => {
  const errors: string[] = [];

  if (!STRIPE_PUBLISHABLE_KEY) {
    errors.push(
      `Stripe publishable key is not configured for mode "${STRIPE_MODE}". ` +
        `Set ${STRIPE_MODE === "test" ? "VITE_STRIPE_PUBLISHABLE_KEY_TEST" : "VITE_STRIPE_PUBLISHABLE_KEY"} in .env.`
    );
  }

  if (STRIPE_PUBLISHABLE_KEY && !STRIPE_PUBLISHABLE_KEY.startsWith("pk_")) {
    errors.push("Invalid Stripe publishable key format");
  }

  const isLiveKey = STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_");
  const isTestKey = STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_");

  if (!isLiveKey && !isTestKey) {
    errors.push("Stripe key must be either live or test key");
  }

  // Guard against the mode flag and key prefix disagreeing.
  if (STRIPE_MODE === "test" && isLiveKey) {
    errors.push("STRIPE_MODE is 'test' but a live publishable key is configured");
  }
  if (STRIPE_MODE === "live" && isTestKey) {
    errors.push("STRIPE_MODE is 'live' but a test publishable key is configured");
  }

  return {
    isValid: errors.length === 0,
    errors,
    keyType: isLiveKey ? "live" : isTestKey ? "test" : "unknown",
    mode: STRIPE_MODE,
  };
};
