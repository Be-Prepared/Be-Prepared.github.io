import { expect, test } from '@playwright/test';

test('a finished timer rings over any tool', async ({ page }) => {
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('seeded')) {
            sessionStorage.setItem('seeded', '1');
            localStorage.setItem(
                'timer.state',
                JSON.stringify([
                    1,
                    {
                        durationMs: 60000,
                        endAt: Date.now() - 1000,
                        pausedRemainingMs: 0,
                        status: 'running',
                    },
                ])
            );
        }
    });
    await page.goto('/large-text');
    await expect(page.getByText("Time's Up!")).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText("Time's Up!")).toBeHidden();
});

test('timer counts down', async ({ page }) => {
    await page.goto('/timer');
    await page.getByRole('button', { name: '1 min' }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('timer')).toHaveText(/0:5\d/);
    await expect(page.getByText(/Keep Be Prepared open/)).toBeVisible();
});

test('timer setup looks right', async ({ page }) => {
    await page.goto('/timer');
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('timer.png');
});

test('alarm clock is honest about its limits', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-05T07:30:00-05:00'));
    await page.goto('/alarm-clock');
    await expect(page.getByText('Know the limits')).toBeVisible();
    await expect(page.getByText('07:30')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('alarm-clock.png', { fullPage: true });
});
