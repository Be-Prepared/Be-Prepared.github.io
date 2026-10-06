import assert from 'node:assert/strict';
import { test } from 'node:test';
import { litOnRight, moonLitPath } from './moon-drawing';

test('litOnRight flips in the southern hemisphere', () => {
    assert.equal(litOnRight(true, 45), true);
    assert.equal(litOnRight(false, 45), false);
    assert.equal(litOnRight(true, -33), false);
    assert.equal(litOnRight(false, -33), true);
});

test('moonLitPath is empty at new moon', () => {
    assert.equal(moonLitPath(0, true, 50), '');
    assert.equal(moonLitPath(0.001, false, 50), '');
});

test('moonLitPath is a full circle at full moon', () => {
    assert.equal(
        moonLitPath(1, true, 50),
        'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z'
    );
});

test('moonLitPath at the quarters has a straight terminator', () => {
    assert.equal(
        moonLitPath(0.5, true, 50),
        'M50 0A50 50 0 0 1 50 100A0 50 0 0 0 50 0Z'
    );
    assert.equal(
        moonLitPath(0.5, false, 50),
        'M50 0A50 50 0 0 0 50 100A0 50 0 0 1 50 0Z'
    );
});

test('moonLitPath crescent and gibbous terminators bulge the right way', () => {
    // Waxing crescent lit on the right: terminator curves back through the
    // right side (counterclockwise going up).
    assert.equal(
        moonLitPath(0.25, true, 50),
        'M50 0A50 50 0 0 1 50 100A25 50 0 0 0 50 0Z'
    );
    // Gibbous lit on the right: terminator passes through the left side.
    assert.equal(
        moonLitPath(0.75, true, 50),
        'M50 0A50 50 0 0 1 50 100A25 50 0 0 1 50 0Z'
    );
    // Waning crescent lit on the left.
    assert.equal(
        moonLitPath(0.25, false, 50),
        'M50 0A50 50 0 0 0 50 100A25 50 0 0 1 50 0Z'
    );
});

test('moonLitPath clamps out-of-range fractions', () => {
    assert.equal(moonLitPath(-1, true, 10), '');
    assert.equal(moonLitPath(2, true, 10), moonLitPath(1, true, 10));
});
