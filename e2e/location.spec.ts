import { expectNoHorizontalScroll } from './helpers';
import { expect, test } from '@playwright/test';

test.use({
    geolocation: { latitude: 38.8894838, longitude: -77.0352791, accuracy: 5 },
    permissions: ['geolocation'],
});

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('seeded')) {
            sessionStorage.setItem('seeded', '1');
            // Without this, the old preference migration rewraps "points".
            localStorage.setItem('preferenceVersion', JSON.stringify([1, 1]));
            localStorage.setItem(
                'points',
                JSON.stringify([
                    1,
                    [
                        {
                            created: 0,
                            id: 1,
                            lat: 38.8894838,
                            lon: -77.0352791,
                            name: 'Washington Monument',
                        },
                    ],
                ])
            );
        }
    });
});

test('share sheet offers links that keep the coordinates', async ({ page }) => {
    await page.goto('/location-edit/1');
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Share' }).first().click();
    const content = page.locator('location-share .content');
    await expect(content).toContainText('location-add?lat=38.8894838&lon=-77.0352791');

    await page.getByRole('radio', { name: /^Apple Maps/ }).click();
    await expect(content).toHaveText(
        'https://maps.apple.com/place?coordinate=38.8894838,-77.0352791&name=Washington%20Monument'
    );

    await page.getByRole('radio', { name: /^Geo link with name/ }).click();
    await expect(content).toHaveText(
        'geo:38.8894838,-77.0352791?q=38.8894838,-77.0352791(Washington%20Monument)'
    );

    await page.getByRole('radio', { name: /^Geo link, coordinates only/ }).click();
    await expect(content).toHaveText('geo:38.8894838,-77.0352791');
});

test('a Be Prepared link adds the waypoint with its name', async ({ page }) => {
    await page.goto('/location-add?lat=47.6205&lon=-122.3493&name=Space%20Needle');
    await expect(page).toHaveURL(/\/location-edit\/\d+$/);
    const points = await page.evaluate(
        () => JSON.parse(localStorage.getItem('points') as string)[1]
    );
    expect(points[points.length - 1]).toMatchObject({
        lat: 47.6205,
        lon: -122.3493,
        name: 'Space Needle',
    });
});
