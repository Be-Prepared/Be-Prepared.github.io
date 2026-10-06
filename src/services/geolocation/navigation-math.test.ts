import {
    describeRelativeBearing,
    formatGlideRatio,
    formatVerticalSpeed,
    relativeBearing,
    velocityMadeGood,
} from './navigation-math';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('relativeBearing wraps to [-180, 180)', () => {
    assert.equal(relativeBearing(90, 0), 90);
    assert.equal(relativeBearing(0, 90), -90);
    assert.equal(relativeBearing(10, 350), 20);
    assert.equal(relativeBearing(350, 10), -20);
    assert.equal(relativeBearing(180, 0), -180);
    assert.equal(relativeBearing(45, 45), 0);
    assert.equal(relativeBearing(720 + 30, -360), 30);
});

test('describeRelativeBearing', () => {
    assert.deepEqual(describeRelativeBearing(35.4), {
        degrees: 35,
        side: 'RIGHT',
    });
    assert.deepEqual(describeRelativeBearing(-12.6), {
        degrees: 13,
        side: 'LEFT',
    });
    assert.deepEqual(describeRelativeBearing(0.3), {
        degrees: 0,
        side: 'AHEAD',
    });
    assert.deepEqual(describeRelativeBearing(-180), {
        degrees: 180,
        side: 'BEHIND',
    });
    assert.deepEqual(describeRelativeBearing(179.7), {
        degrees: 180,
        side: 'BEHIND',
    });
});

test('velocityMadeGood', () => {
    const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

    assert.ok(close(velocityMadeGood(5, 90, 90), 5));
    assert.ok(close(velocityMadeGood(5, 90, 270), -5));
    assert.ok(close(velocityMadeGood(5, 0, 90), 0));
    assert.ok(close(velocityMadeGood(2, 60, 0), 1));
    assert.ok(close(velocityMadeGood(2, 350, 10), 2 * Math.cos(Math.PI / 9)));
    assert.equal(velocityMadeGood(0, 90, NaN), 0);
    assert.ok(isNaN(velocityMadeGood(3, 90, NaN)));
});

test('formatVerticalSpeed', () => {
    assert.equal(formatVerticalSpeed(0.123, true, false, 'en-US'), '0.12 m/s');
    assert.equal(formatVerticalSpeed(2.345, true, false, 'en-US'), '2.3 m/s');
    assert.equal(formatVerticalSpeed(12.6, true, false, 'en-US'), '13 m/s');
    assert.equal(formatVerticalSpeed(0.5, true, true, 'en-US'), '+0.50 m/s');
    assert.equal(formatVerticalSpeed(-0.5, true, true, 'en-US'), '-0.50 m/s');
    assert.equal(formatVerticalSpeed(-0.001, true, true, 'en-US'), '0.00 m/s');
    // 1 m/s is about 196.85 ft/min.
    assert.equal(formatVerticalSpeed(1, false, false, 'en-US'), '197 ft/min');
    assert.equal(formatVerticalSpeed(-1, false, true, 'en-US'), '-197 ft/min');
    assert.equal(formatVerticalSpeed(10, false, true, 'en-US'), '+1,969 ft/min');
});

test('formatGlideRatio', () => {
    assert.equal(formatGlideRatio(3.14159, 'en-US'), '3.1');
    assert.equal(formatGlideRatio(12.7, 'en-US'), '13');
});
