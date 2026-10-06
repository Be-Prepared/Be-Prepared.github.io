import { expect, test } from '@playwright/test';

// The app must work with no network once it has been opened. These tests
// let the service worker install, cut the network, and check that the app
// and everything it loads lazily (city list, WASM barcode reader, icons)
// still come from the cache.
test.use({ serviceWorkers: 'allow' });

test('works offline after the first visit', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', "Playwright's WebKit doesn't run service workers");
    await page.goto('/');
    // The app skips registration on localhost so development isn't
    // interrupted by update prompts; register the built worker directly.
    await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Every file the service worker should have cached.
    const precached: string[] = await page.evaluate(async () => {
        const text = await (await fetch('/sw.js')).text();

        return [...text.matchAll(/url:"([^"]+)"/g)].map((m) => '/' + m[1]);
    });
    expect(precached).toContain('/cities.txt');
    expect(precached.some((url) => url.endsWith('.wasm'))).toBe(true);
    expect(precached.some((url) => url.endsWith('.mjs'))).toBe(true);
    expect(precached).toContain('/compass-rose.svg');

    // Wait for installation to finish, then take the page under its control.
    await page.waitForFunction(async () => {
        const registration = await navigator.serviceWorker.ready;

        return registration.active?.state === 'activated';
    });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('app-index-tile').first()).toBeVisible();

    const failed = await page.evaluate(async (urls) => {
        const bad: string[] = [];

        for (const url of urls) {
            try {
                const response = await fetch(url);

                if (!response.ok) {
                    bad.push(`${url} ${response.status}`);
                }
            } catch (error) {
                bad.push(`${url} ${error}`);
            }
        }

        return bad;
    }, precached);
    expect(failed).toEqual([]);

    // A tool route loads offline too (served by the app shell).
    await page.goto('/compass');
    await expect(page.getByRole('button', { name: 'Back' }).first()).toBeVisible();
});
