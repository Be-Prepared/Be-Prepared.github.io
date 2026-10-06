import {
    angleBetween,
    angleFromBase,
    arcPath,
    clampAngle,
    dragAngle,
    formatDegrees,
    labelAngles,
    layout,
    nearestRay,
    pointAt,
    pointerAngle,
    rayLength,
    ticks,
    wedgePath,
} from './protractor-geometry';
import test from 'ava';

const V = { x: 100, y: 200 };

test('clampAngle', (t) => {
    t.is(clampAngle(-5), 0);
    t.is(clampAngle(200), 180);
    t.is(clampAngle(42.5), 42.5);
    t.is(clampAngle(NaN), 0);
});

test('pointerAngle in the upper half-plane', (t) => {
    t.is(pointerAngle(V, { x: 150, y: 200 }), 0);
    t.is(pointerAngle(V, { x: 100, y: 100 }), 90);
    t.is(pointerAngle(V, { x: 50, y: 200 }), 180);
    t.true(Math.abs(pointerAngle(V, { x: 150, y: 150 }) - 45) < 1e-9);
    t.true(Math.abs(pointerAngle(V, { x: 50, y: 150 }) - 135) < 1e-9);
});

test('pointerAngle clamps points below the base', (t) => {
    t.is(pointerAngle(V, { x: 150, y: 260 }), 0);
    t.is(pointerAngle(V, { x: 40, y: 260 }), 180);
    t.is(pointerAngle(V, V), 90);
});

test('nearestRay', (t) => {
    t.is(nearestRay([135, 45], 100), 0);
    t.is(nearestRay([135, 45], 80), 1);
    t.is(nearestRay([135, 45], 0), 1);
});

test('dragAngle keeps the grab offset and clamps', (t) => {
    t.is(dragAngle(45, 50, 60), 55);
    t.is(dragAngle(45, 50, 0), 0);
    t.is(dragAngle(170, 160, 180), 180);
});

test('angleBetween and angleFromBase', (t) => {
    t.is(angleBetween(135, 45), 90);
    t.is(angleBetween(30, 100), 70);
    t.is(angleBetween(-10, 190), 180);
    t.is(angleFromBase(30), 30);
    t.is(angleFromBase(135), 45);
    t.is(angleFromBase(90), 90);
});

test('formatDegrees', (t) => {
    t.is(formatDegrees(90), '90.0°');
    t.is(formatDegrees(33.333), '33.3°');
    t.is(formatDegrees(-0.01), '0.0°');
});

test('pointAt', (t) => {
    t.deepEqual(pointAt(V, 0, 10), { x: 110, y: 200 });
    t.deepEqual(pointAt(V, 90, 10), { x: 100, y: 190 });
    t.deepEqual(pointAt(V, 180, 10), { x: 90, y: 200 });
});

test('layout portrait fits the width', (t) => {
    const result = layout(390, 700);
    t.deepEqual(result.vertex, { x: 195, y: 676 });
    t.is(result.baseY, 676);
    t.true(result.radius <= 195 - 16);
});

test('layout landscape fits the height', (t) => {
    const result = layout(760, 360);
    t.true(result.radius <= 360 - 24 - 96);
    t.true(result.radius > 100);
});

test('wedgePath and arcPath go counterclockwise between the rays', (t) => {
    t.is(wedgePath(V, 10, 90, 0), 'M100 200L110 200A10 10 0 0 0 100 190Z');
    t.is(arcPath(V, 10, 0, 90), 'M110 200A10 10 0 0 0 100 190');
    t.is(wedgePath(V, 10, 45, 45), '');
    t.is(arcPath(V, 10, 45, 45), '');
});

test('ticks', (t) => {
    t.is(ticks(V, 200).length, 181);
    // Only 5° and 10° marks on small screens.
    t.is(ticks(V, 100).length, 37);
    const first = ticks(V, 100)[0];
    t.deepEqual(first.from, { x: 200, y: 200 });
    t.deepEqual(first.to, { x: 191, y: 200 });
});

test('labelAngles', (t) => {
    t.deepEqual(labelAngles(100), [0, 30, 60, 90, 120, 150, 180]);
    t.is(labelAngles(200).length, 19);
});

test('rayLength reaches the edge of the box', (t) => {
    const margins = { side: 10, top: 20 };
    // 200 wide, vertex at (100, 200).
    t.is(rayLength(V, 0, 200, margins), 90);
    t.is(rayLength(V, 180, 200, margins), 90);
    t.is(rayLength(V, 90, 200, margins), 180);
    t.true(Math.abs(rayLength(V, 45, 200, margins) - 90 * Math.SQRT2) < 1e-9);
    t.is(rayLength(V, 90, 200, { side: 10, top: 300 }, 30), 30);
});
