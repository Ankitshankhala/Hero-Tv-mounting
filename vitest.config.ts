import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './supabase/functions/_shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Integration tests that require a live Supabase/DB or network must NOT run in the
    // unit gate. Exclude by path; they can be run separately later.
    exclude: [
      '**/node_modules/**',
      '**/tests/e2e/**',
      '**/*.integration.test.*',
    ],
  },
});
