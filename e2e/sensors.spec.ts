import { expect, test } from '@playwright/test';

// Feeds the motion sensor with synthetic DeviceOrientation events.
test('bubble level reads the tilt', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit has no DeviceOrientationEvent constructor on desktop');
    await page.addInitScript(() => {
        localStorage.setItem('level.mode', JSON.stringify([1, 'surface']));
        setInterval(() => {
            dispatchEvent(
                new DeviceOrientationEvent('deviceorientation', {
                    alpha: 0,
                    beta: 2,
                    gamma: 0,
                })
            );
        }, 50);
    });
    await page.goto('/level');
    await expect(page.locator('level-app .degrees')).toHaveText('2.0°');
});

test('compass points the right way', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit has no DeviceOrientationEvent constructor on desktop');
    await page.addInitScript(() => {
        // Without a real sensor, fall back to the event path.
        delete (window as any).AbsoluteOrientationSensor;
        setInterval(() => {
            dispatchEvent(
                new DeviceOrientationEvent('deviceorientationabsolute', {
                    absolute: true,
                    alpha: 300,
                    beta: 0,
                    gamma: 0,
                })
            );
            dispatchEvent(
                new DeviceOrientationEvent('deviceorientation', {
                    absolute: true,
                    alpha: 300,
                    beta: 0,
                    gamma: 0,
                })
            );
        }, 50);
    });
    await page.goto('/compass');
    // alpha 300 counterclockwise is a bearing of 60 degrees.
    await expect(page.locator('compass-app .degrees')).toHaveText('60°');
});
