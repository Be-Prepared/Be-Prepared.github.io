import {
    axisElevation,
    barDirection,
    barReading,
    calibrate,
    canCalibrate,
    combineTilt,
    defaultOffsets,
    formatDegrees,
    formatSignedDegrees,
    hasOffset,
    isTooFlat,
    isValidOffsets,
    nextIsLevel,
    resetOffset,
    surfaceBubble,
    surfaceReading,
    vialBubble,
} from './level-math';
import { gravityFromEuler } from '../services/motion/motion-math';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

// Phone standing in the plane of a wall, turned clockwise by `degrees`.
const turned = (degrees: number) => {
    const a = (degrees * Math.PI) / 180;

    return { x: Math.sin(a), y: -Math.cos(a), z: 0 };
};

test('surfaceReading on a level surface', () => {
    const r = surfaceReading(gravityFromEuler(0, 0), { x: 0, y: 0 });
    assert.ok(near(r.x, 0) && near(r.y, 0) && near(r.total, 0));
});

test('surfaceReading matches surfaceTilt total without offsets', () => {
    const r = surfaceReading(gravityFromEuler(3, 4), { x: 0, y: 0 });
    // Angle between gravity and the back of the phone.
    const g = gravityFromEuler(3, 4);
    const expected = (Math.acos(-g.z) * 180) / Math.PI;
    assert.ok(near(r.total, expected), `${r.total} vs ${expected}`);
});

test('surfaceReading removes the offset', () => {
    const g = gravityFromEuler(2, -1);
    const offsets = calibrate('surface', g, defaultOffsets());
    const r = surfaceReading(g, offsets.surface);
    assert.ok(near(r.x, 0) && near(r.y, 0) && near(r.total, 0));
});

test('combineTilt', () => {
    assert.equal(combineTilt(0, 0), 0);
    assert.ok(near(combineTilt(3, 0), 3));
    assert.ok(near(combineTilt(0, -3), 3));
    assert.ok(combineTilt(3, 4) > 4.9 && combineTilt(3, 4) < 5.1);
});

test('surfaceBubble floats to the high side', () => {
    // Right edge low: bubble goes left.
    const right = surfaceBubble({ x: 2, y: 0, total: 2 });
    assert.ok(near(right.x, -0.2) && right.y === 0);
    // Top edge low: bottom is high, bubble goes down the screen (+y CSS).
    const top = surfaceBubble({ x: 0, y: 2, total: 2 });
    assert.ok(near(top.y, 0.2) && top.x === 0);
});

test('surfaceBubble is clamped to the edge', () => {
    const b = surfaceBubble({ x: 30, y: 40, total: 45 });
    assert.ok(near(Math.hypot(b.x, b.y), 1));
    assert.ok(near(b.x, -0.6) && near(b.y, 0.8));
});

test('surfaceBubble centered with no tilt', () => {
    assert.deepEqual(surfaceBubble({ x: 0, y: 0, total: 0 }), { x: 0, y: 0 });
});

test('upright: horizontal vial level, vertical vial pinned to the top', () => {
    const reading = barReading(turned(0), { x: 0, y: 0 });
    assert.ok(near(reading.x, 0));
    assert.ok(near(reading.y, 90));
    assert.equal(vialBubble(reading.x), 0);
    assert.equal(vialBubble(reading.y), 1);
});

test('turned clockwise raises the left end of the horizontal vial', () => {
    const reading = barReading(turned(2), { x: 0, y: 0 });
    assert.ok(near(reading.x, -2), `${reading.x}`);
    // Bubble floats toward the raised (left) end.
    assert.ok(near(vialBubble(reading.x), -0.4));
    assert.equal(barDirection(reading.x), 'leftHigh');
});

test('lying flat both vials act as a two-axis level', () => {
    // Top edge raised 1 degree, right edge lowered 2 degrees.
    const g = gravityFromEuler(1, 2);
    const reading = barReading(g, { x: 0, y: 0 });
    assert.ok(near(reading.y, 1, 1e-3), `${reading.y}`);
    assert.ok(near(reading.x, -2, 1e-2), `${reading.x}`);
    // Top raised: the vertical vial's bubble moves up.
    assert.ok(vialBubble(reading.y) > 0);
    // Right end low: the horizontal bubble moves left.
    assert.ok(vialBubble(reading.x) < 0);
});

test('upside down pins the vertical bubble to the bottom', () => {
    assert.equal(vialBubble(axisElevation(turned(180), 'y')), -1);
});

test('barReading removes offsets', () => {
    const reading = barReading(turned(-0.5), { x: 0.5, y: 0 });
    assert.ok(near(reading.x, 0));
});

test('calibrate in bars mode skips a vial standing on end', () => {
    const offsets = calibrate('bars', turned(-0.7), defaultOffsets());
    assert.ok(near(offsets.bars.x, 0.7), `${offsets.bars.x}`);
    // The vertical vial reads ~90 upright; zeroing it would break it.
    assert.equal(offsets.bars.y, 0);
});

test('calibrate and reset only touch the current mode', () => {
    let offsets = calibrate('bars', turned(-0.7), defaultOffsets());
    offsets = calibrate('surface', gravityFromEuler(1, 1), offsets);
    assert.ok(hasOffset('bars', offsets));
    assert.ok(hasOffset('surface', offsets));
    offsets = resetOffset('surface', offsets);
    assert.equal(hasOffset('surface', offsets), false);
    assert.ok(hasOffset('bars', offsets));
    offsets = resetOffset('bars', offsets);
    assert.deepEqual(offsets, defaultOffsets());
});

test('canCalibrate', () => {
    assert.ok(canCalibrate('surface', gravityFromEuler(0, 0)));
    assert.equal(canCalibrate('surface', turned(0)), false);
    assert.ok(canCalibrate('bars', turned(0)));
    assert.ok(canCalibrate('bars', gravityFromEuler(0, 0)));
});

test('isValidOffsets', () => {
    assert.ok(isValidOffsets(defaultOffsets()));
    assert.equal(isValidOffsets(null), false);
    // The old shape from before the bars mode existed.
    assert.equal(
        isValidOffsets({ surface: { x: 0, y: 0 }, horizontal: 0, vertical: 0 }), false
    );
    assert.equal(isValidOffsets({ surface: { x: 0, y: 0 }, bars: { x: NaN, y: 0 } }), false);
});

test('vialBubble is clamped', () => {
    assert.equal(vialBubble(0), 0);
    assert.ok(near(vialBubble(2.5), 0.5));
    assert.equal(vialBubble(20), 1);
    assert.equal(vialBubble(-20), -1);
});

test('nextIsLevel has hysteresis', () => {
    assert.ok(nextIsLevel(false, 0.4));
    assert.equal(nextIsLevel(false, 0.6), false);
    assert.ok(nextIsLevel(true, 0.6));
    assert.equal(nextIsLevel(true, 0.8), false);
    assert.ok(nextIsLevel(false, -0.3));
});

test('isTooFlat', () => {
    assert.ok(isTooFlat(gravityFromEuler(0, 0)));
    assert.equal(isTooFlat(gravityFromEuler(90, 0)), false);
    assert.equal(isTooFlat(turned(10)), false);
});

test('formatDegrees', () => {
    assert.equal(formatDegrees(0), '0.0°');
    assert.equal(formatDegrees(-0.04), '0.0°');
    assert.equal(formatDegrees(1.26), '1.3°');
    assert.equal(formatDegrees(-12.34), '12.3°');
});

test('formatSignedDegrees', () => {
    assert.equal(formatSignedDegrees(0), '0.0°');
    assert.equal(formatSignedDegrees(-0.04), '0.0°');
    assert.equal(formatSignedDegrees(0.25), '+0.3°');
    assert.equal(formatSignedDegrees(-1.5), '−1.5°');
});

test('barDirection', () => {
    assert.equal(barDirection(0.01), null);
    assert.equal(barDirection(1), 'rightHigh');
    assert.equal(barDirection(-1), 'leftHigh');
});
