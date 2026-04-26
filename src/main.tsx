
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { hydrateStripeMode, subscribeStripeModeRealtime } from './lib/stripe'

// Hydrate Stripe mode from DB before first render. Don't await — the
// fallback (env hint, default "live") is safe and Stripe is only loaded
// inside event handlers, by which time hydration will have completed.
hydrateStripeMode().then(() => {
  subscribeStripeModeRealtime();
});

createRoot(document.getElementById("root")!).render(<App />);
