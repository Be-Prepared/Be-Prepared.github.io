import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test.describe('in Arabic', () => {
    test.use({ locale: 'ar' });

    test('the browser language is used, right to left', async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        await expect(page.getByText('نص كبير', { exact: true })).toBeVisible();
        errors.expectNone();
    });
});

test('a language picked on the Info screen sticks', async ({ page }) => {
    await page.goto('/info');
    await page.locator('info-preferences select').first().selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await page.goto('/');
    await expect(page.getByText('Großer Text', { exact: true })).toBeVisible();

    await page.goto('/info');
    await page.locator('info-preferences select').first().selectOption('auto');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
});
