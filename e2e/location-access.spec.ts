import { expect, Page, test } from '@playwright/test';
import { blockedCamera, watchErrors } from './helpers';

// A fake GPS, installed again on every page load like the real one.
//
// "sticky" behaves like Safari: once a page has been refused, every later
// request from that page is refused without asking, and the browser always
// says it would ask. Only a new page load starts over. The test "fixes the
// phone's settings" by setting sessionStorage.locationAllowed.
function installGeolocation(options: { reported: string; sticky: boolean; firstError?: number }) {
    sessionStorage.setItem('loads', `${+(sessionStorage.getItem('loads') || 0) + 1}`);
    let refused = false;
    let failures = options.firstError ? 1 : 0;
    const error = (code: number) => ({
        code,
        message: '',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
    });
    const answer = (success: PositionCallback, failure?: PositionErrorCallback | null) => {
        if (refused || sessionStorage.getItem('locationAllowed') !== '1') {
            refused = options.sticky;
            failure?.(error(1) as GeolocationPositionError);
        } else if (failures > 0) {
            failures -= 1;
            failure?.(error(options.firstError!) as GeolocationPositionError);
        } else {
            success({
                coords: {
                    accuracy: 5,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    latitude: 38.8894838,
                    longitude: -77.0352791,
                    speed: null,
                },
                timestamp: Date.now(),
            } as GeolocationPosition);
        }
    };
    const timers = new Map<number, ReturnType<typeof setInterval>>();
    let nextId = 1;
    const geolocation = {
        clearWatch: (id: number) => {
            clearInterval(timers.get(id));
            timers.delete(id);
        },
        getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) =>
            setTimeout(() => answer(success, failure), 20),
        watchPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => {
            const id = nextId++;
            timers.set(id, setInterval(() => answer(success, failure), 100));

            return id;
        },
    };
    Object.defineProperty(Navigator.prototype, 'geolocation', {
        configurable: true,
        get: () => geolocation,
    });
    const query = Permissions.prototype.query;
    Permissions.prototype.query = function (descriptor: any) {
        return descriptor.name === 'geolocation'
            ? Promise.resolve({ state: options.reported, onchange: null } as any)
            : query.call(this, descriptor);
    };
}

const loads = (page: Page) => page.evaluate(() => +sessionStorage.getItem('loads')!);
const coordinates = (page: Page) => page.locator('location-app .coordinates');

// Regression test: with location switched off for Safari, "Try Again" did
// nothing even after it was switched back on, because Safari keeps refusing
// a page it has refused once.
test('try again asks again after location is unblocked in Settings', async ({ page }) => {
    await page.addInitScript(installGeolocation, { reported: 'prompt', sticky: true });
    const errors = watchErrors(page);
    await page.goto('/location');
    await expect(page.getByText('Permission Needed')).toBeVisible();
    await page.getByRole('button', { name: 'Allow' }).click();
    await expect(page.getByText('Permission Blocked')).toBeVisible();
    expect(await loads(page)).toBe(1);

    await page.evaluate(() => sessionStorage.setItem('locationAllowed', '1'));
    await page.getByRole('button', { name: 'Try Again' }).click();
    // A fresh page, which the browser is willing to ask.
    await expect(page.getByText('Permission Needed')).toBeVisible();
    expect(await loads(page)).toBe(2);
    await page.getByRole('button', { name: 'Allow' }).click();
    await expect(coordinates(page)).toContainText('38°');
    errors.expectNone();
});

test('try again says so when it is still blocked', async ({ page }) => {
    await page.addInitScript(installGeolocation, { reported: 'denied', sticky: false });
    await page.goto('/location');
    await expect(page.getByText('Permission Blocked')).toBeVisible();
    await expect(page.getByText('Tried again')).toHaveCount(0);

    const retry = page.getByRole('button', { name: 'Try Again' });
    await retry.click();
    await expect(page.getByRole('button', { name: 'Checking…' })).toBeVisible();
    await expect(page.getByText('Tried again. It is still blocked.')).toBeVisible();
    await expect(retry).toBeVisible();
    // The browser itself remembers this block, so starting over is no use.
    expect(await loads(page)).toBe(1);

    // Allowed in the browser's settings: the next press works.
    await page.evaluate(() => sessionStorage.setItem('locationAllowed', '1'));
    await retry.click();
    await expect(coordinates(page)).toContainText('38°');
    expect(await loads(page)).toBe(1);
});

test.describe('on an iPhone', () => {
    test.use({
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    });

    test('a blocked location names the settings to change', async ({ page }) => {
        await page.addInitScript(installGeolocation, { reported: 'prompt', sticky: true });
        await page.goto('/location');
        await page.getByRole('button', { name: 'Allow' }).click();
        const hint = page.locator('access-screen .hint');
        await expect(hint).toContainText('Location Services');
        await expect(hint).toContainText('Safari Websites');
        await expect(hint.locator('li')).toHaveCount(3);
    });

    test('a blocked camera keeps the general advice', async ({ page }) => {
        await blockedCamera(page);
        await page.goto('/magnifier');
        await expect(page.getByText('Permission Blocked')).toBeVisible();
        await expect(page.locator('access-screen .hint')).toContainText('iOS is blocking it');
        await expect(page.locator('access-screen .hint li')).toHaveCount(0);
    });
});

// Regression test: a good fix after an error left the screen blank.
test('the position shows once an error clears', async ({ page }) => {
    await page.addInitScript(installGeolocation, {
        firstError: 2,
        reported: 'granted',
        sticky: false,
    });
    await page.addInitScript(() => sessionStorage.setItem('locationAllowed', '1'));
    const errors = watchErrors(page);
    await page.goto('/location');
    await expect(coordinates(page)).toContainText('38°');
    await expect(page.getByText('There was an error')).toHaveCount(0);
    errors.expectNone();
});
