import {
    combinedAccess,
    formatDegrees,
    hangingReading,
    nextIsLevel,
    pitchDirection,
    rollDirection,
} from './picture-hanging-math';
import { AccessState } from '../services/access/access-controller';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

// Phone upright facing a wall, turned clockwise by `roll` and with the top
// leaning away by `pitch`.
const held = (roll: number, pitch: number) => {
    const r = (roll * Math.PI) / 180;
    const p = (pitch * Math.PI) / 180;

    return {
        x: Math.sin(r) * Math.cos(p),
        y: -Math.cos(r) * Math.cos(p),
        z: -Math.sin(p),
    };
};

test('hangingReading upright and level', () => {
    const r = hangingReading(held(0, 0));
    assert.ok(near(r.roll, 0) && near(r.pitch, 0) && near(r.rotation, 0));
    assert.ok(r.upright);
});

test('hangingReading turned and leaning', () => {
    const r = hangingReading(held(2, -3));
    assert.ok(near(r.roll, 2), `${r.roll}`);
    assert.ok(near(r.rotation, -2));
    assert.ok(near(r.pitch, -3), `${r.pitch}`);
});

test('hangingReading in landscape folds to the nearest axis', () => {
    const r = hangingReading(held(91, 0));
    assert.ok(near(r.roll, 1));
    assert.ok(near(r.rotation, -1));
});

test('hangingReading not upright when flat', () => {
    assert.equal(hangingReading({ x: 0, y: -0.1, z: -0.99 }).upright, false);
});

test('nextIsLevel needs both axes and has hysteresis', () => {
    assert.ok(nextIsLevel(false, hangingReading(held(0.3, 0.2))));
    assert.equal(nextIsLevel(false, hangingReading(held(0.3, 0.6))), false);
    assert.equal(nextIsLevel(false, hangingReading(held(0.6, 0))), false);
    assert.ok(nextIsLevel(true, hangingReading(held(0.6, -0.6))));
    assert.equal(nextIsLevel(true, hangingReading(held(0.8, 0))), false);
    assert.equal(
        nextIsLevel(true, { roll: 0, pitch: 0, rotation: 0, upright: false }), false
    );
});

test('combinedAccess asks for the camera first', () => {
    assert.deepEqual(combinedAccess(AccessState.PROMPT, AccessState.PROMPT), {
        state: AccessState.PROMPT,
        source: 'camera',
    });
    assert.deepEqual(combinedAccess(AccessState.READY, AccessState.PROMPT), {
        state: AccessState.PROMPT,
        source: 'motion',
    });
    assert.deepEqual(combinedAccess(AccessState.READY, AccessState.READY), {
        state: AccessState.READY,
        source: 'motion',
    });
    assert.deepEqual(combinedAccess(AccessState.DENIED, AccessState.READY), {
        state: AccessState.DENIED,
        source: 'camera',
    });
});

test('directions', () => {
    assert.equal(rollDirection(0.02), null);
    assert.equal(rollDirection(1), 'leftHigh');
    assert.equal(rollDirection(-1), 'rightHigh');
    assert.equal(pitchDirection(-0.04), null);
    assert.equal(pitchDirection(2), 'topAway');
    assert.equal(pitchDirection(-2), 'topToward');
});

test('formatDegrees', () => {
    assert.equal(formatDegrees(-0.04), '0.0°');
    assert.equal(formatDegrees(-2.26), '2.3°');
});
