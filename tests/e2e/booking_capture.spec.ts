import { test, expect } from '@playwright/test';

const SUPABASE_FUNCTION_BASE = 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1';

test('E2E booking → capture → invoice succeeds (simulated)', async ({ request }) => {
  const resp = await request.post(`${SUPABASE_FUNCTION_BASE}/test-e2e-booking-capture`, {
    headers: { 'Content-Type': 'application/json' },
    data: {},
  });
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  expect(json.success).toBeTruthy();
  expect(json.booking_id).toBeTruthy();
  // Invoice may be generated asynchronously; check presence when returned
  if (json.invoice) {
    expect(json.invoice.id).toBeTruthy();
  }
});
