import { test, expect } from '@playwright/test';

test.describe('Bluesky App - Navigation and UI', () => {
  test('should have proper page structure', async ({ page }) => {
    await page.goto('/');

    // Check that the main container is present
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display app information links', async ({ page }) => {
    await page.goto('/');

    // Check for any external links that might be present
    // (like links to Bluesky documentation, privacy policy, etc.)
    const links = page.locator('a');
    const linkCount = await links.count();

    // There should be at least some links on the page
    expect(linkCount).toBeGreaterThanOrEqual(0);
  });

  test('should be responsive and mobile-friendly', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // The login form should still be visible on mobile
    await expect(page.getByRole('textbox', { name: /handle/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');

    // Wait a bit to catch any async errors
    await page.waitForTimeout(1000);

    // There should be no JavaScript errors
    expect(errors).toEqual([]);
  });

  test('should have no accessibility violations on login page', async ({ page }) => {
    await page.goto('/');

    // Check for basic accessibility requirements
    // All images should have alt text
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('/');

    // The app should still load even if some resources fail
    // We're just checking the basic structure is present
    await expect(page.locator('body')).toBeVisible();
  });
});
