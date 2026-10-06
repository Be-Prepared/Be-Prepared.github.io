import {
    screenToProtractor,
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
import assert from 'node:assert/strict';
import { test } from 'node:test';

const V = { x: 100, y: 200 };

test('clampAngle', () => {
    assert.equal(clampAngle(-5), 0);
    assert.equal(clampAngle(200), 180);
    assert.equal(clampAngle(42.5), 42.5);
    assert.equal(clampAngle(NaN), 0);
});

test('pointerAngle in the upper half-plane', () => {
    assert.equal(pointerAngle(V, { x: 150, y: 200 }), 0);
    assert.equal(pointerAngle(V, { x: 100, y: 100 }), 90);
    assert.equal(pointerAngle(V, { x: 50, y: 200 }), 180);
    assert.ok(Math.abs(pointerAngle(V, { x: 150, y: 150 }) - 45) < 1e-9);
    assert.ok(Math.abs(pointerAngle(V, { x: 50, y: 150 }) - 135) < 1e-9);
});

test('pointerAngle clamps points below the base', () => {
    assert.equal(pointerAngle(V, { x: 150, y: 260 }), 0);
    assert.equal(pointerAngle(V, { x: 40, y: 260 }), 180);
    assert.equal(pointerAngle(V, V), 90);
});

test('nearestRay', () => {
    assert.equal(nearestRay([135, 45], 100), 0);
    assert.equal(nearestRay([135, 45], 80), 1);
    assert.equal(nearestRay([135, 45], 0), 1);
});

test('dragAngle keeps the grab offset and clamps', () => {
    assert.equal(dragAngle(45, 50, 60), 55);
    assert.equal(dragAngle(45, 50, 0), 0);
    assert.equal(dragAngle(170, 160, 180), 180);
});

test('angleBetween and angleFromBase', () => {
    assert.equal(angleBetween(135, 45), 90);
    assert.equal(angleBetween(30, 100), 70);
    assert.equal(angleBetween(-10, 190), 180);
    assert.equal(angleFromBase(30), 30);
    assert.equal(angleFromBase(135), 45);
    assert.equal(angleFromBase(90), 90);
});

test('formatDegrees', () => {
    assert.equal(formatDegrees(90), '90.0°');
    assert.equal(formatDegrees(33.333), '33.3°');
    assert.equal(formatDegrees(-0.01), '0.0°');
});

test('pointAt', () => {
    assert.deepEqual(pointAt(V, 0, 10), { x: 110, y: 200 });
    assert.deepEqual(pointAt(V, 90, 10), { x: 100, y: 190 });
    assert.deepEqual(pointAt(V, 180, 10), { x: 90, y: 200 });
});

test('layout portrait fits the width', () => {
    const result = layout(390, 700);
    assert.deepEqual(result.vertex, { x: 195, y: 676 });
    assert.equal(result.baseY, 676);
    assert.ok(result.radius <= 195 - 16);
});

test('layout landscape fits the height', () => {
    const result = layout(760, 360);
    assert.ok(result.radius <= 360 - 24 - 96);
    assert.ok(result.radius > 100);
});

test('wedgePath and arcPath go counterclockwise between the rays', () => {
    assert.equal(wedgePath(V, 10, 90, 0), 'M100 200L110 200A10 10 0 0 0 100 190Z');
    assert.equal(arcPath(V, 10, 0, 90), 'M110 200A10 10 0 0 0 100 190');
    assert.equal(wedgePath(V, 10, 45, 45), '');
    assert.equal(arcPath(V, 10, 45, 45), '');
});

test('ticks', () => {
    assert.equal(ticks(V, 200).length, 181);
    // Only 5° and 10° marks on small screens.
    assert.equal(ticks(V, 100).length, 37);
    const first = ticks(V, 100)[0];
    assert.deepEqual(first.from, { x: 200, y: 200 });
    assert.deepEqual(first.to, { x: 191, y: 200 });
});

test('labelAngles', () => {
    assert.deepEqual(labelAngles(100), [0, 30, 60, 90, 120, 150, 180]);
    assert.equal(labelAngles(200).length, 19);
});

test('rayLength reaches the edge of the box', () => {
    const margins = { side: 10, top: 20 };
    // 200 wide, vertex at (100, 200).
    assert.equal(rayLength(V, 0, 200, margins), 90);
    assert.equal(rayLength(V, 180, 200, margins), 90);
    assert.equal(rayLength(V, 90, 200, margins), 180);
    assert.ok(Math.abs(rayLength(V, 45, 200, margins) - 90 * Math.SQRT2) < 1e-9);
    assert.equal(rayLength(V, 90, 200, { side: 10, top: 300 }, 30), 30);
});

test('screenToProtractor leaves landscape alone', () => {
    assert.deepEqual(screenToProtractor({ x: 10, y: 20 }, false, 300), { x: 10, y: 20 });
});

test('screenToProtractor undoes the portrait turn', () => {
    // Drawing height 390 (the screen's width). The vertex at the middle of
    // the base, drawing (365, 362), is drawn at screen (390 - 362, 365).
    assert.deepEqual(screenToProtractor({ x: 28, y: 365 }, true, 390), { x: 365, y: 362 });
    // A point straight to the right of the vertex on screen is "up" in the
    // drawing, which is 90 degrees.
    const p = screenToProtractor({ x: 228, y: 365 }, true, 390);
    assert.deepEqual(p, { x: 365, y: 162 });
});
