
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { hydrateStripeMode, subscribeStripeModeRealtime } from './lib/stripe'

// Self-heal stale code-split chunks after a new deploy.
// When a lazy import fails because its hashed chunk no longer exists,
// reload once to pull the fresh index.html + assets. The timestamp guard
// prevents an infinite reload loop if a reload doesn't resolve it.
window.addEventListener('vite:preloadError', () => {
  const last = Number(sessionStorage.getItem('chunkReloadAt') || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem('chunkReloadAt', String(Date.now()));
    window.location.reload();
  }
});

// Hydrate Stripe mode from DB before first render. Don't await — the
// fallback (env hint, default "live") is safe and Stripe is only loaded
// inside event handlers, by which time hydration will have completed.
hydrateStripeMode().then(() => {
  subscribeStripeModeRealtime();
});

createRoot(document.getElementById("root")!).render(<App />);
