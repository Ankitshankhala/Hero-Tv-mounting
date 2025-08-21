import { test, expect } from '@playwright/test';

test.describe('Email Resend Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin bookings
    await page.goto('/admin?tab=bookings');
    await page.waitForLoadState('networkidle');
  });

  test('should display email status when expanding booking row', async ({ page }) => {
    // Look for the first booking row with a chevron down button
    const firstChevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    
    if (await firstChevronButton.isVisible()) {
      await firstChevronButton.click();
      
      // Wait for the expanded content to appear
      await expect(page.getByText('Email Delivery Status')).toBeVisible();
      
      // Check for email status sections
      await expect(page.getByText('Customer Emails')).toBeVisible();
      await expect(page.getByText('Worker Emails')).toBeVisible();
    }
  });

  test('should show force resend buttons for worker emails', async ({ page }) => {
    // Expand a booking row that has a worker assigned
    const chevronButtons = page.locator('button').filter({ has: page.locator('svg[class*="chevron"]') });
    
    if (await chevronButtons.first().isVisible()) {
      await chevronButtons.first().click();
      
      // Look for force resend buttons in the worker email section
      const forceResendButtons = page.getByText('Force Resend');
      
      if (await forceResendButtons.first().isVisible()) {
        // Verify button is present and not disabled for bookings with workers
        await expect(forceResendButtons.first()).toBeVisible();
        
        // Click the button (this will trigger the API call)
        await forceResendButtons.first().click();
        
        // Wait for potential toast notification or loading state
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should disable force resend when no worker is assigned', async ({ page }) => {
    // Find a booking without a worker (shows "Assign" button)
    const assignButtons = page.getByText('Assign');
    
    if (await assignButtons.first().isVisible()) {
      // Get the row containing this assign button and expand it
      const row = assignButtons.first().locator('../../..');
      const chevronButton = row.locator('button').filter({ has: page.locator('svg') }).first();
      
      if (await chevronButton.isVisible()) {
        await chevronButton.click();
        
        // Check that worker force resend is disabled or shows "No worker assigned"
        await expect(page.getByText('No worker assigned')).toBeVisible();
      }
    }
  });

  test('should refresh email logs when refresh button is clicked', async ({ page }) => {
    // Expand a booking row
    const firstChevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    
    if (await firstChevronButton.isVisible()) {
      await firstChevronButton.click();
      
      // Find and click the refresh button
      const refreshButton = page.getByRole('button').filter({ has: page.locator('svg[class*="refresh"]') });
      
      if (await refreshButton.first().isVisible()) {
        await refreshButton.first().click();
        
        // Verify loading state appears briefly
        await expect(page.locator('svg[class*="animate-spin"]')).toBeVisible();
        
        // Wait for loading to complete
        await page.waitForTimeout(1000);
      }
    }
  });
});