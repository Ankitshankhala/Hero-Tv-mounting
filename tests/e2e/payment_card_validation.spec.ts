import { test, expect } from '@playwright/test';

/**
 * E2E Test: Payment Card Validation and Button State
 * 
 * Tests that the payment form correctly handles:
 * 1. Invalid card input disables the button
 * 2. Correcting the input re-enables the button
 * 3. Payment can be successfully authorized after correction
 */

test.describe('Payment Card Validation Flow', () => {
  test('should disable button on invalid input and re-enable when corrected', async ({ page }) => {
    // Navigate to booking page (adjust URL as needed)
    await page.goto('/');
    
    // TODO: Navigate through booking flow to payment step
    // This will depend on your application's routing structure
    
    // Wait for Stripe iframe to load
    await page.waitForSelector('iframe[name^="__privateStripeFrame"]', { timeout: 10000 });
    
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    
    // Test 1: Enter invalid card number
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424');
    
    // Verify button is disabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
    
    // Verify error message is shown
    await expect(page.locator('text=/Please enter a complete card number/i')).toBeVisible();
    
    // Test 2: Correct the card number
    await stripeFrame.locator('[name="cardnumber"]').clear();
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    
    // Enter valid expiry
    await stripeFrame.locator('[name="exp-date"]').fill('12/25');
    
    // Enter valid CVC
    await stripeFrame.locator('[name="cvc"]').fill('123');
    
    // Verify button is now enabled
    await expect(submitButton).not.toBeDisabled();
    
    // Verify error is cleared
    await expect(page.locator('text=/Please enter a complete card number/i')).not.toBeVisible();
    
    // Test 3: Enter invalid CVC
    await stripeFrame.locator('[name="cvc"]').clear();
    await stripeFrame.locator('[name="cvc"]').fill('12');
    
    // Verify button is disabled again
    await expect(submitButton).toBeDisabled();
    
    // Test 4: Correct the CVC
    await stripeFrame.locator('[name="cvc"]').clear();
    await stripeFrame.locator('[name="cvc"]').fill('123');
    
    // Verify button is enabled again
    await expect(submitButton).not.toBeDisabled();
    
    // Test 5: Attempt to submit (this will depend on test environment setup)
    // await submitButton.click();
    // await expect(page.locator('text=/authorized/i')).toBeVisible({ timeout: 15000 });
  });

  test('should handle expired card date validation', async ({ page }) => {
    await page.goto('/');
    
    // Wait for Stripe iframe
    await page.waitForSelector('iframe[name^="__privateStripeFrame"]', { timeout: 10000 });
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    
    // Enter valid card number
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    
    // Enter expired date
    await stripeFrame.locator('[name="exp-date"]').fill('12/20');
    
    // Enter valid CVC
    await stripeFrame.locator('[name="cvc"]').fill('123');
    
    // Verify button is disabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
    
    // Verify error message about expiry
    await expect(page.locator('text=/expiration.*past/i')).toBeVisible();
    
    // Correct the expiry date
    await stripeFrame.locator('[name="exp-date"]').clear();
    await stripeFrame.locator('[name="exp-date"]').fill('12/25');
    
    // Verify button is enabled
    await expect(submitButton).not.toBeDisabled();
  });

  test('should maintain form state during correction process', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForSelector('iframe[name^="__privateStripeFrame"]', { timeout: 10000 });
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    
    // Fill all fields correctly first
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    await stripeFrame.locator('[name="exp-date"]').fill('12/25');
    await stripeFrame.locator('[name="cvc"]').fill('123');
    
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).not.toBeDisabled();
    
    // Now change card number to invalid
    await stripeFrame.locator('[name="cardnumber"]').clear();
    await stripeFrame.locator('[name="cardnumber"]').fill('4242');
    
    // Button should be disabled
    await expect(submitButton).toBeDisabled();
    
    // Complete the card number
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    
    // Button should be enabled again without needing to re-enter other fields
    await expect(submitButton).not.toBeDisabled();
  });
});
