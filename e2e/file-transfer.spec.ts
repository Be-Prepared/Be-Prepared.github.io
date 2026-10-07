import { crc32, decodeFrame, joinBlocks, unpackFile } from '../src/file-transfer-app/frame-format';
import { expect, test } from '@playwright/test';
import { FountainDecoder } from '../src/file-transfer-app/fountain';
import { randomBytes } from 'node:crypto';
import { pictureCamera, watchErrors } from './helpers';

// The sender runs in the browser (so its compression and frame building are
// that browser's), and the frames are decoded here with the receiver's code,
// skipping most of them like a camera would.
test('a file survives the trip with most frames missed', async ({ page }) => {
    const errors = watchErrors(page);
    const file = Buffer.concat([randomBytes(12000), Buffer.from('compressible '.repeat(2000))]);
    await page.goto('/file-transfer-send');
    await page.locator('file-transfer-send-app input[type=file]').setInputFiles({
        buffer: file,
        mimeType: 'application/octet-stream',
        name: 'résumé.bin',
    });
    const qr = page.locator('file-transfer-send-app qr-code');
    await expect(qr).toHaveAttribute('content', /^https:\/\/be-prepared\.github\.io\/r#[0-9A-Z$*\-./:]+$/);

    let decoder: FountainDecoder | null = null;
    let length = 0;
    let checksum = 0;
    let last = '';
    let shown = 0;

    while (!decoder?.done) {
        const content = (await qr.getAttribute('content'))!;

        if (content === last) {
            await page.waitForTimeout(20);
            continue;
        }

        last = content;
        shown += 1;

        // Keep one frame in three.
        if (shown % 3) {
            continue;
        }

        const frame = decodeFrame(content);
        length = frame.length;
        checksum = frame.checksum;
        decoder ??= new FountainDecoder(Math.ceil(frame.length / frame.block.length));
        decoder.add(frame.seed, frame.block);
        expect(shown).toBeLessThan(2000);
    }

    const container = joinBlocks(decoder.blocks(), length);
    expect(crc32(container)).toBe(checksum);
    const [data, meta] = await unpackFile(container);
    expect(Buffer.from(data).equals(file)).toBe(true);
    expect(meta).toEqual({ contentType: 'application/octet-stream', filename: 'résumé.bin' });
    // Compression made it smaller than the file.
    expect(length).toBeLessThan(file.length);
    errors.expectNone();
});

// The whole trip in the app itself: the sender's QR codes are shown to the
// receiver's camera one at a time until the file arrives.
test('the receiver rebuilds a file from the sender screen', async ({ context }) => {
    test.slow();
    const file = randomBytes(3000);
    const sender = await context.newPage();
    await sender.goto('/file-transfer-send');
    await sender.locator('file-transfer-send-app input[type=file]').setInputFiles({
        buffer: file,
        mimeType: 'application/octet-stream',
        name: 'random.bin',
    });
    const code = sender.locator('file-transfer-send-app qr-code svg');
    await expect(code).toBeVisible();

    const receiver = await context.newPage();
    const errors = watchErrors(receiver);
    await pictureCamera(receiver);
    await receiver.goto('/r');
    await expect(receiver.locator('file-transfer-receive-app video')).toBeVisible();
    const view = receiver.locator('file-transfer-receive-view');
    const status = receiver.locator('file-transfer-receive-app .center');

    for (let shown = 0; !(await view.isVisible()); shown += 1) {
        // A stuck receiver would loop forever; its status says how far it got.
        expect(shown, (await status.textContent().catch(() => '')) || '').toBeLessThan(150);
        const svg = await code.evaluate((element) => element.outerHTML);
        await receiver.evaluate((text) => (window as any).__show(text), svg);
        await receiver.waitForTimeout(250);
    }

    await expect(view).toContainText('random.bin');
    errors.expectNone();
});
