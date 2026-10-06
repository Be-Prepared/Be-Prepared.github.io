import assert from 'node:assert/strict';
import { decodable, peel } from './decoder.mjs';
import { mulberry32 } from './prng.mjs';
import { test } from 'node:test';

// Independent check: rank of the full 0/1 matrix over GF(2), using plain
// arrays of BigInt rows.
function fullRank(equations, k) {
    const rows = equations.map((eq) =>
        eq.reduce((row, s) => row ^ (1n << BigInt(s)), 0n)
    );
    let rank = 0;

    for (let c = 0; c < k; c += 1) {
        const bit = 1n << BigInt(c);
        const pivot = rows.findIndex((row, i) => i >= rank && row & bit);

        if (pivot < 0) {
            continue;
        }

        [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];

        for (let i = 0; i < rows.length; i += 1) {
            if (i !== rank && rows[i] & bit) {
                rows[i] ^= rows[rank];
            }
        }

        rank += 1;
    }

    return rank;
}

function randomSystem(rng, k, n, maxDegree) {
    const equations = [];

    for (let i = 0; i < n; i += 1) {
        const degree = 1 + Math.floor(rng() * maxDegree);
        const set = new Set();

        while (set.size < Math.min(degree, k)) {
            set.add(Math.floor(rng() * k));
        }

        equations.push([...set]);
    }

    return equations;
}

test('peel+GE succeeds exactly when the matrix has full rank', () => {
    const rng = mulberry32(42);

    for (let trial = 0; trial < 500; trial += 1) {
        const k = 2 + Math.floor(rng() * 20);
        const n = k + Math.floor(rng() * k);
        const equations = randomSystem(rng, k, n, 6);
        const expected = fullRank(equations, k) === k;
        assert.equal(decodable(equations, n, k, 'peel+ge').ok, expected, `trial ${trial}`);
    }
});

test('peeling never claims more than full rank allows', () => {
    const rng = mulberry32(7);

    for (let trial = 0; trial < 500; trial += 1) {
        const k = 2 + Math.floor(rng() * 20);
        const n = k + Math.floor(rng() * k);
        const equations = randomSystem(rng, k, n, 4);

        if (decodable(equations, n, k, 'peel').ok) {
            assert.equal(fullRank(equations, k), k);
        }
    }
});

test('peeling resolves a simple chain', () => {
    // b0, b0^b1, b1^b2 -> all three.
    const result = peel([[0], [0, 1], [1, 2]], 3, 3);
    assert.equal(result.resolved, 3);
});

test('only the first n equations count', () => {
    const equations = [[0], [1], [2]];
    assert.equal(decodable(equations, 2, 3, 'peel+ge').ok, false);
    assert.equal(decodable(equations, 3, 3, 'peel+ge').ok, true);
});

test('elimination solves what peeling cannot', () => {
    // No degree-1 equations, but the system has full rank.
    const equations = [[0, 1], [1, 2], [0, 1, 2]];
    assert.equal(decodable(equations, 3, 3, 'peel').ok, false);
    assert.equal(decodable(equations, 3, 3, 'peel+ge').ok, true);
});
