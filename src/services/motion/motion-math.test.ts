import {
    gravityFromEuler,
    offLevel,
    screenPitch,
    screenRoll,
    smoothVector,
    surfaceTilt,
    toScreenFrame,
} from './motion-math';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e;

test('flat face up points gravity into the back of the phone', () => {
    const g = gravityFromEuler(0, 0);
    assert.ok(near(g.x, 0) && near(g.y, 0) && near(g.z, -1));
});

test('upright portrait points gravity out the bottom edge', () => {
    const g = gravityFromEuler(90, 0);
    assert.ok(near(g.x, 0) && near(g.y, -1) && near(g.z, 0));
});

test('surfaceTilt on a level surface', () => {
    const tilt = surfaceTilt(gravityFromEuler(0, 0));
    assert.ok(near(tilt.x, 0) && near(tilt.y, 0) && near(tilt.total, 0));
});

test('surfaceTilt raising the top edge', () => {
    // beta 5: top edge lifted 5 degrees, so down is toward the bottom edge.
    const tilt = surfaceTilt(gravityFromEuler(5, 0));
    assert.ok(near(tilt.y, -5, 1e-6), `${tilt.y}`);
    assert.ok(near(tilt.x, 0));
    assert.ok(near(tilt.total, 5, 1e-6));
});

test('surfaceTilt raising the left edge', () => {
    // gamma 3: rolled so the right edge goes down.
    const tilt = surfaceTilt(gravityFromEuler(0, 3));
    assert.ok(near(tilt.x, 3, 1e-6), `${tilt.x}`);
    assert.ok(near(tilt.total, 3, 1e-6));
});

test('screenRoll is 0 upright and positive when turned clockwise', () => {
    assert.ok(near(screenRoll({ x: 0, y: -1, z: 0 }), 0));
    const angle = (10 * Math.PI) / 180;
    // Device turned clockwise by 10 degrees.
    const g = { x: Math.sin(angle), y: -Math.cos(angle), z: 0 };
    assert.ok(near(screenRoll(g), 10, 1e-9));
});

test('offLevel folds any edge onto the nearest level/plumb line', () => {
    assert.equal(offLevel(0), 0);
    assert.equal(offLevel(3), 3);
    assert.equal(offLevel(-3), -3);
    assert.equal(offLevel(92), 2);
    assert.equal(offLevel(-88), 2);
    assert.equal(offLevel(178), -2);
    assert.equal(offLevel(45), 45);
    assert.equal(offLevel(-45), 45);
});

test('screenPitch is 0 when the screen is vertical', () => {
    assert.ok(near(screenPitch({ x: 0, y: -1, z: 0 }), 0));
});

test('screenPitch is positive when the top leans away', () => {
    // Top leaning back means the screen faces slightly up, so gravity goes
    // partly into the back of the phone (-z).
    const angle = (4 * Math.PI) / 180;
    assert.ok(
        near(screenPitch({ x: 0, y: -Math.cos(angle), z: -Math.sin(angle) }), 4, 1e-9)
    );
});

test('toScreenFrame for landscape', () => {
    // Turned counterclockwise into landscape, the device's right edge is the
    // top of the screen.
    const v = toScreenFrame({ x: 1, y: 0, z: 0 }, 90);
    assert.ok(near(v.x, 0) && near(v.y, 1));
    const w = toScreenFrame({ x: 0, y: -1, z: 0 }, 90);
    assert.ok(near(w.x, 1) && near(w.y, 0));
});

test('smoothVector', () => {
    assert.deepEqual(smoothVector(null, { x: 1, y: 2, z: 3 }, 0.5), {
        x: 1,
        y: 2,
        z: 3,
    });
    assert.deepEqual(smoothVector({ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }, 0.5), {
        x: 1,
        y: 2,
        z: 3,
    });
});
