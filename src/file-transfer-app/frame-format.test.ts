import {
    crc32,
    decodeFrame,
    encodeFrame,
    fromAlphanumeric,
    joinBlocks,
    packFile,
    splitBlocks,
    toAlphanumeric,
    unpackFile,
    URL_PREFIX,
} from './frame-format';
import assert from 'node:assert/strict';
import { segmentsFor } from '../services/qr.service';
import { test } from 'node:test';

const bytes = (...values: number[]) => Uint8Array.from(values);

test('alphanumeric encoding round-trips every length and value', () => {
    for (let length = 0; length < 9; length += 1) {
        for (const fill of [0, 1, 127, 255]) {
            const data = new Uint8Array(length).fill(fill);
            assert.deepEqual(fromAlphanumeric(toAlphanumeric(data)), data);
        }
    }

    const all = Uint8Array.from({ length: 512 }, (_, i) => (i * 7919) & 0xff);
    const text = toAlphanumeric(all);
    assert.equal(text.length, 768);
    assert.match(text, /^[0-9A-Z$*\-./:]*$/);
    assert.deepEqual(fromAlphanumeric(text), all);
});

test('alphanumeric decoding rejects damaged text', () => {
    assert.throws(() => fromAlphanumeric('A'));
    assert.throws(() => fromAlphanumeric('ab'));
    assert.throws(() => fromAlphanumeric(':::'));
});

test('crc32 matches the standard check value', () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('frames round-trip and use the receiver URL', () => {
    const frame = { checksum: 0xdeadbeef, length: 1234, seed: 42, block: bytes(1, 2, 3, 4, 5) };
    const text = encodeFrame(frame);
    assert.ok(text.startsWith(URL_PREFIX));
    assert.deepEqual(decodeFrame(text), frame);
});

test('frames from the old format are rejected', () => {
    assert.throws(() => decodeFrame(`${URL_PREFIX}AAAAAQAAA+8AAAEsAAAAAA==`));
    assert.throws(() => decodeFrame('hello'));
});

test('frames go in a byte segment and an alphanumeric segment', () => {
    const text = encodeFrame({ checksum: 1, length: 300, seed: 7, block: new Uint8Array(300) });
    const segments = segmentsFor(text);
    assert.deepEqual(
        segments.map((s) => s.mode),
        ['Byte', 'Alphanumeric']
    );
    assert.equal(segments[0].data, URL_PREFIX);
    assert.equal(segments.map((s) => s.data).join(''), text);
    assert.deepEqual(segmentsFor('geo:1,2'), [{ data: 'geo:1,2', mode: 'Byte' }]);
});

test('blocks split with padding and join back to the exact length', () => {
    const data = Uint8Array.from({ length: 23 }, (_, i) => i);
    const blocks = splitBlocks(data, 10);
    assert.equal(blocks.length, 3);
    assert.ok(blocks.every((b) => b.length === 10));
    assert.deepEqual(joinBlocks(blocks, 23), data);
});

test('files round-trip with their name and type', async () => {
    const meta = { contentType: 'text/plain', filename: 'notes – ünïcode.txt' };

    for (const file of [new TextEncoder().encode('hello '.repeat(500)), bytes(0, 255, 3)]) {
        const container = await packFile(file, meta);
        const [data, unpacked] = await unpackFile(container);
        assert.deepEqual(data, file);
        assert.deepEqual(unpacked, meta);
    }
});

test('repetitive files are compressed', async () => {
    const file = new TextEncoder().encode('hello '.repeat(500));
    const container = await packFile(file, { contentType: '', filename: 'a' });
    assert.equal(container[0], 1);
    assert.ok(container.length < 100);
});

test('a real QR reader returns a frame unchanged', async () => {
    const { scanImageData } = await import('@undecaf/zbar-wasm');
    const qrcode = (await import('qrcode-generator')).default;
    const text = encodeFrame({
        checksum: 0x01020304,
        length: 5000,
        seed: 0xfffffffe,
        block: Uint8Array.from({ length: 400 }, (_, i) => (i * 37) & 0xff),
    });
    const qr = qrcode(0, 'L');

    for (const segment of segmentsFor(text)) {
        qr.addData(segment.data, segment.mode);
    }

    qr.make();
    const scale = 4;
    const margin = 4;
    const count = qr.getModuleCount();
    const size = (count + margin * 2) * scale;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);

    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const row = Math.floor(y / scale) - margin;
            const col = Math.floor(x / scale) - margin;

            if (row >= 0 && col >= 0 && row < count && col < count && qr.isDark(row, col)) {
                data.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 3);
            }
        }
    }

    const symbols = await scanImageData({ data, width: size, height: size, colorSpace: 'srgb' } as ImageData);
    assert.equal(symbols.length, 1);
    assert.equal(symbols[0].decode(), text);
    assert.deepEqual(decodeFrame(symbols[0].decode()).seed, 0xfffffffe);
});
