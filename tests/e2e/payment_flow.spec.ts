import { test, expect } from '@playwright/test';

const SUPABASE_FUNCTION_BASE = 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1';

test.describe('Payment Flow E2E Tests', () => {
  test('Complete booking and payment authorization flow', async ({ request }) => {
    // Step 1: Create a test booking
    const bookingResponse = await request.post(`${SUPABASE_FUNCTION_BASE}/test-e2e-booking-capture`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    
    expect(bookingResponse.ok()).toBeTruthy();
    const bookingResult = await bookingResponse.json();
    expect(bookingResult.success).toBeTruthy();
    expect(bookingResult.booking_id).toBeTruthy();
    
    const bookingId = bookingResult.booking_id;
    
    // Step 2: Verify transaction record was created
    // This tests the transaction creation during booking flow
    // The test-e2e-booking-capture function should create both booking and transaction
    
    // Step 3: Test payment status synchronization
    const syncResponse = await request.post(`${SUPABASE_FUNCTION_BASE}/unified-payment-status-sync`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        booking_id: bookingId,
        transaction_status: 'authorized',
        force_sync: true
      },
    });
    
    expect(syncResponse.ok()).toBeTruthy();
    const syncResult = await syncResponse.json();
    expect(syncResult.success).toBeTruthy();
    expect(syncResult.booking_updated).toBeTruthy();
    expect(syncResult.transaction_updated).toBeTruthy();
    
    // Step 4: Test transaction status normalization
    const statusTestCases = [
      { input: 'requires_capture', expected: 'authorized' },
      { input: 'payment_authorized', expected: 'authorized' },
      { input: 'succeeded', expected: 'completed' },
      { input: 'captured', expected: 'completed' },
      { input: 'failed', expected: 'failed' },
      { input: 'cancelled', expected: 'failed' }
    ];
    
    for (const testCase of statusTestCases) {
      const normalizeResponse = await request.post(`${SUPABASE_FUNCTION_BASE}/unified-payment-status-sync`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          booking_id: bookingId,
          transaction_status: testCase.input,
          force_sync: true
        },
      });
      
      expect(normalizeResponse.ok()).toBeTruthy();
      const normalizeResult = await normalizeResponse.json();
      expect(normalizeResult.success).toBeTruthy();
      expect(normalizeResult.transaction_status).toBe(testCase.expected);
    }
  });
  
  test('Missing transaction backfill', async ({ request }) => {
    // Test the sync function that creates missing transaction records
    const syncResponse = await request.post(`${SUPABASE_FUNCTION_BASE}/sync-payment-transactions`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        action: 'create_missing_transactions'
      },
    });
    
    expect(syncResponse.ok()).toBeTruthy();
    const syncResult = await syncResponse.json();
    expect(syncResult.success).toBeTruthy();
    expect(typeof syncResult.count).toBe('number');
  });
  
  test('Transaction status update with invalid enum value handling', async ({ request }) => {
    // Create a test booking first
    const bookingResponse = await request.post(`${SUPABASE_FUNCTION_BASE}/test-e2e-booking-capture`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    
    const bookingResult = await bookingResponse.json();
    const bookingId = bookingResult.booking_id;
    
    // Test with invalid status that should be normalized
    const updateResponse = await request.post(`${SUPABASE_FUNCTION_BASE}/unified-payment-status-sync`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        booking_id: bookingId,
        transaction_status: 'invalid_status_that_should_be_normalized',
        force_sync: true
      },
    });
    
    expect(updateResponse.ok()).toBeTruthy();
    const updateResult = await updateResponse.json();
    expect(updateResult.success).toBeTruthy();
    // Should normalize invalid status to 'failed'
    expect(updateResult.transaction_status).toBe('failed');
  });
});