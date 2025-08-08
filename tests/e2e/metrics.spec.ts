import { test, expect } from '@playwright/test';

const SUPABASE_FUNCTION_BASE = 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1';

test('Alert metrics endpoint returns sane numbers', async ({ request }) => {
  const resp = await request.get(`${SUPABASE_FUNCTION_BASE}/alert-metrics`);
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  expect(json.window_hours).toBe(24);
  for (const key of ['sms_failed','email_failed','sms_total','email_total']) {
    expect(typeof json[key]).toBe('number');
    expect(json[key]).toBeGreaterThanOrEqual(0);
  }
});
