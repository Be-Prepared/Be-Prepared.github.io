import { FountainDecoder, FountainEncoder, frameIndexer, mulberry32, robustSoliton } from './fountain';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const randomBlocks = (k: number, size: number, seed: number) => {
    const rng = mulberry32(seed);

    return Array.from({ length: k }, () =>
        Uint8Array.from({ length: size }, () => Math.floor(rng() * 256))
    );
};

// Sends frames, dropping some, until the decoder finishes. Returns how
// many frames it received.
const transfer = (k: number, seed: number, keep: (n: number) => boolean) => {
    const blocks = randomBlocks(k, 16, seed);
    const encoder = new FountainEncoder(blocks);
    const decoder = new FountainDecoder(k);
    const seeds = mulberry32(seed + 1);

    for (let shown = 0; shown < k * 50; shown += 1) {
        const frameSeed = Math.floor(seeds() * 4294967296);

        if (keep(shown) && decoder.add(frameSeed, encoder.frame(frameSeed))) {
            assert.deepEqual(decoder.blocks(), blocks);

            return decoder.receivedCount;
        }
    }

    throw new Error('Did not decode');
};

test('mulberry32 matches experiments/transfer, so sender and receiver agree', () => {
    const rng = mulberry32(1);
    assert.deepEqual(
        [rng(), rng()].map((x) => x.toFixed(8)),
        ['0.62707394', '0.00273572']
    );
});

test('robustSoliton is a cumulative distribution ending at 1', () => {
    const table = robustSoliton(1000);
    assert.equal(table.length, 1000);
    assert.ok(Math.abs(table[table.length - 1] - 1) < 1e-12);
    assert.ok(table.every((p, i) => i === 0 || p >= table[i - 1]));
});

test('frame indices are distinct, in range, and depend only on the seed', () => {
    const index = frameIndexer(500);

    for (let seed = 0; seed < 2000; seed += 1) {
        const indices = index(seed);
        assert.equal(new Set(indices).size, indices.length);
        assert.ok(indices.every((i) => i >= 0 && i < 500));
        assert.deepEqual(frameIndexer(500)(seed), indices);
    }
});

test('a single block decodes from one frame', () => {
    assert.equal(transfer(1, 3, () => true), 1);
});

test('decodes small files exactly', () => {
    for (const k of [2, 3, 5, 10, 40]) {
        for (let seed = 0; seed < 20; seed += 1) {
            transfer(k, seed * 31 + k, () => true);
        }
    }
});

test('needs barely more than k frames, whatever is lost', () => {
    const k = 400;
    const patterns: [string, (n: number) => boolean][] = [
        ['none', () => true],
        ['every other frame', (n) => n % 2 === 0],
        ['90% lost', (n) => n % 10 === 0],
        ['late start, then 25% lost', (n) => n >= 3 * k && n % 4 !== 0],
    ];

    for (const [name, keep] of patterns) {
        let worst = 0;

        for (let seed = 0; seed < 10; seed += 1) {
            worst = Math.max(worst, transfer(k, seed * 7 + 1, keep));
        }

        assert.ok(worst <= k * 1.05, `${name}: ${worst} frames for ${k} blocks`);
    }
});

test('extra and duplicate frames are harmless', () => {
    const blocks = randomBlocks(30, 8, 9);
    const encoder = new FountainEncoder(blocks);
    const decoder = new FountainDecoder(30);

    for (let seed = 0; !decoder.done; seed += 1) {
        decoder.add(seed, encoder.frame(seed));
        decoder.add(seed, encoder.frame(seed));
    }

    assert.deepEqual(decoder.blocks(), blocks);
    assert.equal(decoder.add(12345, encoder.frame(12345)), true);
});

test('solved blocks are removed from every waiting frame right away', () => {
    const k = 300;
    const blocks = randomBlocks(k, 8, 77);
    const encoder = new FountainEncoder(blocks);
    const decoder = new FountainDecoder(k);
    // Looks inside: the test is about the bookkeeping, not the result.
    const inside = decoder as unknown as {
        _equations: { blocks: number[]; data: Uint8Array; done: boolean; remaining: number }[];
        _values: (Uint8Array | null)[];
        _waiting: number[][];
    };

    for (let seed = 1000; !decoder.done; seed += 1) {
        decoder.add(seed, encoder.frame(seed));

        if (decoder.done) {
            break;
        }

        inside._equations.forEach((equation, id) => {
            if (equation.done) {
                // Finished frames hold no memory.
                assert.equal(equation.blocks.length + equation.data.length, 0);

                return;
            }

            const unknown = equation.blocks.filter((b) => !inside._values[b]);
            assert.equal(equation.remaining, unknown.length);
            // One unknown block would have been solved; none means done.
            assert.ok(unknown.length >= 2, `frame ${id} left with ${unknown.length}`);
            // The data is exactly the XOR of the blocks still unknown.
            const expected = new Uint8Array(8);
            unknown.forEach((b) => blocks[b].forEach((byte, i) => (expected[i] ^= byte)));
            assert.deepEqual(equation.data, expected);
            // And each of those blocks knows this frame is waiting on it.
            unknown.forEach((b) => assert.ok(inside._waiting[b].includes(id)));
        });
        inside._values.forEach((value, b) => {
            if (value) {
                assert.deepEqual(value, blocks[b]);
                assert.equal(inside._waiting[b].length, 0);
            }
        });
    }

    assert.deepEqual(decoder.blocks(), blocks);
});
