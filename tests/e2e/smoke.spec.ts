import { test, expect } from '@playwright/test';

// Basic SEO and Stripe config smoke test
const SUPABASE_FUNCTION_BASE = 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1';

test('homepage loads and has correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Hero TV Mounting/i);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Hero TV Mounting/i);
});

test('Stripe config function responds successfully', async ({ request }) => {
  const resp = await request.post(`${SUPABASE_FUNCTION_BASE}/test-stripe-config`, {
    headers: { 'Content-Type': 'application/json' },
    data: {},
  });
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  expect(json.success).toBeTruthy();
  expect(["live","test","unknown"]).toContain(json.keyType);
});
