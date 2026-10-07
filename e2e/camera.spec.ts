import { blockedCamera, fakeCamera, manyCameras, watchErrors } from './helpers';
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

// The camera opened most recently. Some browsers open the camera more than
// once while a screen starts, so the tests look at the latest.
const latest = (page: import('@playwright/test').Page) =>
    page.evaluate(() => ((window as any).__opened as string[]).slice(-1)[0]);
const liveStreams = (page: import('@playwright/test').Page) =>
    page.evaluate(
        () =>
            (window as any).__streams.filter((stream: MediaStream) =>
                stream.getTracks().some((track) => track.readyState === 'live')
            ).length
    );

test('one camera per side shows no switch button', async ({ page }) => {
    await fakeCamera(page);
    await page.goto('/magnifier');
    await expect(page.locator('magnifier-app video')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch camera' })).toHaveCount(0);
});

test('switch camera cycles the back cameras and is remembered', async ({ page }) => {
    await manyCameras(page);
    const errors = watchErrors(page);
    await page.goto('/magnifier');
    const button = page.getByRole('button', { name: 'Switch camera' });
    await expect(button).toBeVisible();
    expect(await latest(page)).toBe('back-0');

    await button.click();
    await expect(page.getByText('Camera 2 of 2')).toBeVisible();
    await expect.poll(() => latest(page)).toBe('back-1');
    // The old camera was closed, not left running beside the new one.
    await expect.poll(() => liveStreams(page)).toBe(1);

    await button.click();
    await expect(page.getByText('Camera 1 of 2')).toBeVisible();
    await expect.poll(() => latest(page)).toBe('back-0');
    await button.click();
    await expect.poll(() => latest(page)).toBe('back-1');
    await expect.poll(() => liveStreams(page)).toBe(1);

    // Another back-camera tool opens the chosen lens straight away.
    await page.goto('/barcode-reader');
    await expect(page.getByRole('button', { name: 'Switch camera' })).toBeVisible();
    expect(await latest(page)).toBe('back-1');
    errors.expectNone();
});

test('the mirror switches between front cameras only', async ({ page }) => {
    await manyCameras(page);
    await page.goto('/mirror');
    const button = page.getByRole('button', { name: 'Switch camera' });
    await expect(button).toBeVisible();
    expect(await latest(page)).toBe('front-0');
    await button.click();
    await expect.poll(() => latest(page)).toBe('front-1');
    await button.click();
    await expect.poll(() => latest(page)).toBe('front-0');
});

test('a chosen camera that is gone falls back to the default', async ({ page }) => {
    await manyCameras(page);
    await page.addInitScript(() => {
        localStorage.setItem('preferenceVersion', '[1,1]');
        localStorage.setItem('camera.environment', JSON.stringify([1, 'unplugged']));
    });
    await page.goto('/protractor');
    await expect(page.getByRole('button', { name: 'Switch camera' })).toBeVisible();
    expect(await latest(page)).toBe('back-0');
});

test('the flashlight ignores the chosen lens', async ({ page }) => {
    await manyCameras(page);
    await page.addInitScript(() => {
        localStorage.setItem('preferenceVersion', '[1,1]');
        localStorage.setItem('camera.environment', JSON.stringify([1, 'back-1']));
    });
    await page.goto('/flashlight');
    await expect.poll(() => latest(page)).toBe('back-0');
});

// Picture hanging has the button too, but its screen also waits for a
// motion sensor, which these browsers don't have.
for (const tool of ['protractor', 'r']) {
    test(`${tool} has the switch camera button`, async ({ page }) => {
        await manyCameras(page);
        await page.goto(`/${tool}`);
        await expect(page.getByRole('button', { name: 'Switch camera' })).toBeVisible();
    });
}

// With too many buttons for one line, the first ones move to a second line
// and Back stays in the corner:
//
//           V  W
//     <  X  Y  Z
test('a crowded toolbar wraps onto a second line', async ({ page }) => {
    await manyCameras(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/mirror');
    const box = async (name: string) =>
        (await page.getByRole('button', { name }).boundingBox())!;
    await expect(page.getByRole('button', { name: 'Switch camera' })).toBeVisible();
    const [back, light, change, zoomOut, zoomIn, freeze] = [
        await box('Back'),
        await box('Light ring'),
        await box('Switch camera'),
        await box('Zoom out'),
        await box('Zoom in'),
        await box('Freeze image'),
    ];

    // Bottom line, in order, with Back at the left edge.
    for (const other of [zoomOut, zoomIn, freeze]) {
        expect(other.y).toBe(back.y);
    }

    expect(back.x).toBeLessThan(zoomOut.x);
    expect(zoomOut.x).toBeLessThan(zoomIn.x);
    expect(zoomIn.x).toBeLessThan(freeze.x);
    // Second line above it, ending at the same edge.
    expect(light.y).toBeLessThan(back.y);
    expect(change.y).toBe(light.y);
    expect(light.x).toBeLessThan(change.x);
    expect(change.x).toBe(freeze.x);
    // Nothing runs off the screen.
    expect(freeze.x + freeze.width).toBeLessThanOrEqual(320);

    // Sideways: Back in the bottom corner, a second column further in.
    await page.setViewportSize({ width: 640, height: 320 });
    await expect.poll(async () => (await box('Back')).x).toBe((await box('Freeze image')).x);
    expect((await box('Light ring')).x).toBeLessThan((await box('Back')).x);
    expect((await box('Back')).y).toBeGreaterThan((await box('Zoom out')).y);

    // With room for everything, it's one line again.
    await page.setViewportSize({ width: 412, height: 800 });
    await expect.poll(async () => (await box('Light ring')).y).toBe((await box('Back')).y);
});
