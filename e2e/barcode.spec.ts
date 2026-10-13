import { expect, Page, test } from '@playwright/test';
import { pictureCamera, watchErrors } from './helpers';
import { QrService } from '../src/services/qr.service';

const qr = new QrService();
const show = (page: Page, text: string) =>
    page.evaluate((svg) => (window as any).__show(svg), qr.svg(text, 'M'));
// An empty picture, like pointing the phone away from the code. Waits until
// the app's video really shows it: the fake camera can run seconds behind,
// and a late frame of the old code would be read as a new scan.
const clear = async (page: Page) => {
    await page.evaluate(() =>
        (window as any).__show(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9"><rect width="9" height="9" fill="#fff"/></svg>'
        )
    );
    await expect
        .poll(() =>
            page.evaluate(() => {
                const video = document.querySelector('barcode-reader-app video') as HTMLVideoElement;
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const context = canvas.getContext('2d')!;
                context.drawImage(video, 0, 0, 64, 64);
                const pixels = context.getImageData(0, 0, 64, 64).data;
                let dark = 0;

                for (let i = 0; i < pixels.length; i += 4) {
                    dark += pixels[i] < 128 ? 1 : 0;
                }

                return dark;
            })
        )
        .toBe(0);
};

// The first read waits for the WASM reader to load, and the fake camera is
// slow in WebKit when the machine is busy.
const SCAN = { timeout: 20000 };

// Regression test: after a result was dismissed, the scanner didn't read
// anything else until the screen was reopened.
for (const dismiss of ['the button', 'a tap outside']) {
    test(`scans another code after closing the result with ${dismiss}`, async ({ page }) => {
        await pictureCamera(page);
        const errors = watchErrors(page);
        await page.goto('/barcode-reader');
        await expect(page.locator('barcode-reader-app video')).toBeVisible();
        const result = page.locator('barcode-reader-app .result');
        const close = async () => {
            if (dismiss === 'the button') {
                await page.getByRole('button', { name: 'Scan Again' }).click();
            } else {
                await page.mouse.click(5, 5);
            }

            await expect(result).toHaveCount(0);
        };

        await show(page, 'first code');
        await expect(result).toContainText('first code', SCAN);
        await clear(page);
        await close();

        await show(page, 'second code');
        await expect(result).toContainText('second code', SCAN);
        await clear(page);
        await close();

        // And a link, which is shown differently.
        await show(page, 'https://example.com/third');
        await expect(result).toContainText('https://example.com/third', SCAN);
        await clear(page);
        await close();

        await show(page, 'fourth code');
        await expect(result).toContainText('fourth code', SCAN);
        errors.expectNone();
    });
}

// The code is usually still in front of the camera when the result is
// closed. It must not pop straight back up, but must be readable again.
test('the same code can be scanned again after a moment', async ({ page }) => {
    await pictureCamera(page);
    await page.goto('/barcode-reader');
    await expect(page.locator('barcode-reader-app video')).toBeVisible();
    const result = page.locator('barcode-reader-app .result');

    await show(page, 'same code');
    await expect(result).toContainText('same code', SCAN);
    await page.getByRole('button', { name: 'Scan Again' }).click();
    await expect(result).toHaveCount(0);
    await expect(result).toContainText('same code', SCAN);
});
