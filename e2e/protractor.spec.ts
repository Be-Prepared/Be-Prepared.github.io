import { blockedCamera } from './helpers';
import { expect, test } from '@playwright/test';

test('a ray can be dragged smoothly and the handle is never replaced', async ({
    page,
}) => {
    await blockedCamera(page);
    await page.goto('/protractor');
    const handle = page.locator('protractor-app circle.handle').first();
    await expect(handle).toBeVisible();
    await page.evaluate(() => {
        (window as any).__handle = document.querySelector('protractor-app circle.handle');
    });
    const angle = page.locator('protractor-app .angle');
    await expect(angle).toHaveText('90.0°');

    const box = (await handle.boundingBox())!;
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const readings: string[] = [];

    // A slow, sustained drag in many small steps.
    for (let i = 1; i <= 20; i += 1) {
        await page.mouse.move(start.x - i * 6, start.y + i * 4);
        await page.waitForTimeout(30);
        readings.push((await angle.textContent()) || '');
    }

    await page.mouse.up();
    // The reading kept changing through the whole drag, not just once.
    expect(new Set(readings).size).toBeGreaterThan(5);
    await expect(angle).not.toHaveText('90.0°');
    expect(
        await page.evaluate(
            () =>
                (window as any).__handle ===
                document.querySelector('protractor-app circle.handle')
        )
    ).toBe(true);
});

test('protractor uses the long edge in portrait', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Phones are portrait');
    await blockedCamera(page);
    await page.goto('/protractor');
    const scale = page.locator('protractor-app path.scale');
    await expect(scale).toBeVisible();
    const box = (await scale.boundingBox())!;
    // Turned on its side: taller than wide.
    expect(box.height).toBeGreaterThan(box.width);
});
