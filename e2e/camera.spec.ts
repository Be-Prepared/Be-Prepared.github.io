import { blockedCamera, fakeCamera, watchErrors } from './helpers';
import { expect, test } from '@playwright/test';

test('magnifier shows the camera with digital zoom', async ({ page }) => {
    await fakeCamera(page);
    const errors = watchErrors(page);
    await page.goto('/magnifier');
    await expect(page.locator('magnifier-app video')).toBeVisible();
    // The fake camera has no hardware zoom, so it starts at 2x digital.
    await expect(page.getByText('2.0×')).toBeVisible();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByText('3.0×')).toBeVisible();
    errors.expectNone();
});

// Regression test: leaving a camera tool must stop the camera, or it stays
// locked (and its light stays on) after the app is closed.
for (const tool of ['magnifier', 'barcode-reader', 'mirror']) {
    test(`leaving ${tool} stops the camera`, async ({ page }) => {
        await fakeCamera(page);
        await page.goto('/');
        await page.evaluate((path) => {
            history.pushState({}, '', path);
            dispatchEvent(new PopStateEvent('popstate'));
        }, `/${tool}`);
        await expect.poll(() =>
            page.evaluate(() => (window as any).__streams.length)
        ).toBeGreaterThan(0);
        await page.getByRole('button', { name: 'Back' }).first().click();
        await expect(page.locator('app-index-tile').first()).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(() =>
                    (window as any).__streams.every((stream: MediaStream) =>
                        stream
                            .getTracks()
                            .every((track) => track.readyState === 'ended')
                    )
                )
            )
            .toBe(true);
    });
}

test('a blocked camera explains how to fix it and can retry', async ({ page }) => {
    await blockedCamera(page);
    await page.goto('/magnifier');
    await expect(page.getByText('Permission Blocked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
    await expect(page).toHaveScreenshot('camera-blocked.png');
});

test('the magnifier tile stays on the home screen when blocked', async ({ page }) => {
    await blockedCamera(page);
    await page.goto('/');
    await expect(page.getByText('Magnifier', { exact: true })).toBeVisible();
});
