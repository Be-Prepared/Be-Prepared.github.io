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
import test from 'ava';

const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

// Phone standing in the plane of a wall, turned clockwise by `degrees`.
const turned = (degrees: number) => {
    const a = (degrees * Math.PI) / 180;

    return { x: Math.sin(a), y: -Math.cos(a), z: 0 };
};

test('surfaceReading on a level surface', (t) => {
    const r = surfaceReading(gravityFromEuler(0, 0), { x: 0, y: 0 });
    t.true(near(r.x, 0) && near(r.y, 0) && near(r.total, 0));
});

test('surfaceReading matches surfaceTilt total without offsets', (t) => {
    const r = surfaceReading(gravityFromEuler(3, 4), { x: 0, y: 0 });
    // Angle between gravity and the back of the phone.
    const g = gravityFromEuler(3, 4);
    const expected = (Math.acos(-g.z) * 180) / Math.PI;
    t.true(near(r.total, expected), `${r.total} vs ${expected}`);
});

test('surfaceReading removes the offset', (t) => {
    const g = gravityFromEuler(2, -1);
    const offsets = calibrate('surface', g, defaultOffsets());
    const r = surfaceReading(g, offsets.surface);
    t.true(near(r.x, 0) && near(r.y, 0) && near(r.total, 0));
});

test('combineTilt', (t) => {
    t.is(combineTilt(0, 0), 0);
    t.true(near(combineTilt(3, 0), 3));
    t.true(near(combineTilt(0, -3), 3));
    t.true(combineTilt(3, 4) > 4.9 && combineTilt(3, 4) < 5.1);
});

test('surfaceBubble floats to the high side', (t) => {
    // Right edge low: bubble goes left.
    const right = surfaceBubble({ x: 2, y: 0, total: 2 });
    t.true(near(right.x, -0.2) && right.y === 0);
    // Top edge low: bottom is high, bubble goes down the screen (+y CSS).
    const top = surfaceBubble({ x: 0, y: 2, total: 2 });
    t.true(near(top.y, 0.2) && top.x === 0);
});

test('surfaceBubble is clamped to the edge', (t) => {
    const b = surfaceBubble({ x: 30, y: 40, total: 45 });
    t.true(near(Math.hypot(b.x, b.y), 1));
    t.true(near(b.x, -0.6) && near(b.y, 0.8));
});

test('surfaceBubble centered with no tilt', (t) => {
    t.deepEqual(surfaceBubble({ x: 0, y: 0, total: 0 }), { x: 0, y: 0 });
});

test('upright: horizontal vial level, vertical vial pinned to the top', (t) => {
    const reading = barReading(turned(0), { x: 0, y: 0 });
    t.true(near(reading.x, 0));
    t.true(near(reading.y, 90));
    t.is(vialBubble(reading.x), 0);
    t.is(vialBubble(reading.y), 1);
});

test('turned clockwise raises the left end of the horizontal vial', (t) => {
    const reading = barReading(turned(2), { x: 0, y: 0 });
    t.true(near(reading.x, -2), `${reading.x}`);
    // Bubble floats toward the raised (left) end.
    t.true(near(vialBubble(reading.x), -0.4));
    t.is(barDirection(reading.x), 'leftHigh');
});

test('lying flat both vials act as a two-axis level', (t) => {
    // Top edge raised 1 degree, right edge lowered 2 degrees.
    const g = gravityFromEuler(1, 2);
    const reading = barReading(g, { x: 0, y: 0 });
    t.true(near(reading.y, 1, 1e-3), `${reading.y}`);
    t.true(near(reading.x, -2, 1e-2), `${reading.x}`);
    // Top raised: the vertical vial's bubble moves up.
    t.true(vialBubble(reading.y) > 0);
    // Right end low: the horizontal bubble moves left.
    t.true(vialBubble(reading.x) < 0);
});

test('upside down pins the vertical bubble to the bottom', (t) => {
    t.is(vialBubble(axisElevation(turned(180), 'y')), -1);
});

test('barReading removes offsets', (t) => {
    const reading = barReading(turned(-0.5), { x: 0.5, y: 0 });
    t.true(near(reading.x, 0));
});

test('calibrate in bars mode skips a vial standing on end', (t) => {
    const offsets = calibrate('bars', turned(-0.7), defaultOffsets());
    t.true(near(offsets.bars.x, 0.7), `${offsets.bars.x}`);
    // The vertical vial reads ~90 upright; zeroing it would break it.
    t.is(offsets.bars.y, 0);
});

test('calibrate and reset only touch the current mode', (t) => {
    let offsets = calibrate('bars', turned(-0.7), defaultOffsets());
    offsets = calibrate('surface', gravityFromEuler(1, 1), offsets);
    t.true(hasOffset('bars', offsets));
    t.true(hasOffset('surface', offsets));
    offsets = resetOffset('surface', offsets);
    t.false(hasOffset('surface', offsets));
    t.true(hasOffset('bars', offsets));
    offsets = resetOffset('bars', offsets);
    t.deepEqual(offsets, defaultOffsets());
});

test('canCalibrate', (t) => {
    t.true(canCalibrate('surface', gravityFromEuler(0, 0)));
    t.false(canCalibrate('surface', turned(0)));
    t.true(canCalibrate('bars', turned(0)));
    t.true(canCalibrate('bars', gravityFromEuler(0, 0)));
});

test('isValidOffsets', (t) => {
    t.true(isValidOffsets(defaultOffsets()));
    t.false(isValidOffsets(null));
    // The old shape from before the bars mode existed.
    t.false(
        isValidOffsets({ surface: { x: 0, y: 0 }, horizontal: 0, vertical: 0 })
    );
    t.false(isValidOffsets({ surface: { x: 0, y: 0 }, bars: { x: NaN, y: 0 } }));
});

test('vialBubble is clamped', (t) => {
    t.is(vialBubble(0), 0);
    t.true(near(vialBubble(2.5), 0.5));
    t.is(vialBubble(20), 1);
    t.is(vialBubble(-20), -1);
});

test('nextIsLevel has hysteresis', (t) => {
    t.true(nextIsLevel(false, 0.4));
    t.false(nextIsLevel(false, 0.6));
    t.true(nextIsLevel(true, 0.6));
    t.false(nextIsLevel(true, 0.8));
    t.true(nextIsLevel(false, -0.3));
});

test('isTooFlat', (t) => {
    t.true(isTooFlat(gravityFromEuler(0, 0)));
    t.false(isTooFlat(gravityFromEuler(90, 0)));
    t.false(isTooFlat(turned(10)));
});

test('formatDegrees', (t) => {
    t.is(formatDegrees(0), '0.0°');
    t.is(formatDegrees(-0.04), '0.0°');
    t.is(formatDegrees(1.26), '1.3°');
    t.is(formatDegrees(-12.34), '12.3°');
});

test('formatSignedDegrees', (t) => {
    t.is(formatSignedDegrees(0), '0.0°');
    t.is(formatSignedDegrees(-0.04), '0.0°');
    t.is(formatSignedDegrees(0.25), '+0.3°');
    t.is(formatSignedDegrees(-1.5), '−1.5°');
});

test('barDirection', (t) => {
    t.is(barDirection(0.01), null);
    t.is(barDirection(1), 'rightHigh');
    t.is(barDirection(-1), 'leftHigh');
});
