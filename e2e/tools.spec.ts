import { blockedCamera, expectNoHorizontalScroll, watchErrors } from './helpers';
import { expect, test } from '@playwright/test';

// Every tile route should open without errors and show either the tool or
// an explanation of why it can't run here. Hardware is blocked so results
// don't depend on the machine.
const TOOLS = [
    'flashlight',
    'frontLight',
    'alarm',
    'alarm-clock',
    'magnifier',
    'mirror',
    'compass',
    'location',
    'pedometer',
    'speed',
    'level',
    'picture-hanging',
    'protractor',
    'ruler',
    'barcode-reader',
    'nfc',
    'sound-level',
    'heart-rate',
    'metal-detector',
    'timer',
    'stopwatch',
    'sun-moon',
    'file-transfer',
    'large-text',
    'info',
];

for (const tool of TOOLS) {
    test(`${tool} opens cleanly`, async ({ page }) => {
        await blockedCamera(page);
        const errors = watchErrors(page);
        await page.goto(`/${tool}`);
        // Either the tool's own screen or the permission/unavailable screen,
        // and always a way back.
        // Some tools keep their layout in the page while showing the
        // permission screen, so only visible ones count.
        await expect(
            page
                .locator('default-layout, access-screen')
                .filter({ visible: true })
                .first()
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Back' }).first()).toBeVisible();
        await expectNoHorizontalScroll(page);
        errors.expectNone();
    });
}
