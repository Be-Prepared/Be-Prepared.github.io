import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, watchErrors } from './helpers';

test('home screen lists the tools', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle('Be Prepared');
    await expect(page.locator('app-index-tile').first()).toBeVisible();
    // Tools that need no hardware are always there.
    for (const label of ['Front Light', 'Large Text', 'Timer', 'Info']) {
        await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    await expectNoHorizontalScroll(page);
    errors.expectNone();
});

test('tapping a tile opens the tool and back returns home', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Large Text', { exact: true }).click();
    await expect(page).toHaveURL(/\/large-text$/);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('app-index-tile').first()).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
    test(`home screen looks right in ${scheme} mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto('/');
        // Icons load asynchronously.
        await expect(page.locator('app-index-tile svg').first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveScreenshot(`home-${scheme}.png`, {
            fullPage: true,
        });
    });
}

test('long-press and drag rearranges tiles without moving others mid-drag', async ({
    page,
}) => {
    await page.goto('/');
    const tiles = page.locator('app-index app-index-tile');
    await expect(tiles.first()).toBeVisible();
    const before = await tiles.evaluateAll((all) => all.map((t) => t.id));
    const source = tiles.nth(0);
    const target = tiles.nth(4);
    const bystander = tiles.nth(2);
    const sourceBox = (await source.boundingBox())!;
    const targetBox = (await target.boundingBox())!;
    const bystanderBefore = await bystander.boundingBox();

    await page.mouse.move(
        sourceBox.x + sourceBox.width / 2,
        sourceBox.y + sourceBox.height / 2
    );
    await page.mouse.down();
    // Hold still long enough for a long press.
    await page.waitForTimeout(700);
    await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2,
        { steps: 8 }
    );

    // Mid-drag: the original spot is held and nothing else has moved.
    await expect(source).toHaveClass(/placeholder/);
    await expect(target).toHaveClass(/drop-target/);
    expect(await bystander.boundingBox()).toEqual(bystanderBefore);

    await page.mouse.up();
    const after = await tiles.evaluateAll((all) => all.map((t) => t.id));
    expect(after.indexOf(before[0])).toBe(4);
    // Dropping must not open the tool underneath.
    await expect(page).toHaveURL(/\/$/);

    // The order survives a reload.
    await page.reload();
    await expect(tiles.first()).toBeVisible();
    expect(await tiles.evaluateAll((all) => all.map((t) => t.id))).toEqual(after);
});
