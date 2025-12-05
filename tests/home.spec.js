import { expect, test } from '@playwright/test';

test.describe('Bluesky App - Home Page', () => {
  test('should load the home page successfully', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads
    await expect(page).toHaveTitle(/Bluesky App/i);
  });

  test('should display login form when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Wait for the login form to be visible
    await expect(page.getByRole('textbox', { name: /handle/i })).toBeVisible();
    await expect(page.getByLabel(/app password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('should show validation on empty login form submission', async ({ page }) => {
    await page.goto('/');

    // Try to submit without filling the form
    const loginButton = page.getByRole('button', { name: /login/i });
    await loginButton.click();

    // The button should be disabled or show some validation
    // Since we're using HTML5 validation, the form won't submit
    const handleInput = page.getByRole('textbox', { name: /handle/i });
    await expect(handleInput).toHaveAttribute('required', '');
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    await page.goto('/');

    // Check that form inputs have proper labels
    const handleInput = page.getByRole('textbox', { name: /handle/i });
    await expect(handleInput).toBeVisible();

    const passwordInput = page.getByLabel(/app password/i);
    await expect(passwordInput).toBeVisible();

    const loginButton = page.getByRole('button', { name: /login/i });
    await expect(loginButton).toBeVisible();
  });
});
