import { test, expect } from '@playwright/test';

// Admin and Worker basic flows without real auth

test.describe('Worker and Admin pages', () => {
  test('Worker Login page renders form and SEO', async ({ page }) => {
    await page.goto('/worker-login');
    await expect(page).toHaveTitle(/Worker Login/i);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  });

  test('Admin page shows login when unauthenticated and is noindexed', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveTitle(/Admin Dashboard|Admin Access/i);
    await expect(page.getByText('Admin Access')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    // Robots noindex present
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/i);
  });
});
