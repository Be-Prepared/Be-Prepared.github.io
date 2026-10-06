import {
    DIGITAL_ZOOM_MAX,
    formatZoom,
    hardwareZoomFromCapabilities,
    initialZoom,
    pinchZoom,
    planZoom,
    stepZoom,
    zoomLimits,
} from './zoom';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const ANDROID = { min: 1, max: 8, step: 0.1 };
const WIDE = { min: 0.5, max: 10, step: 0.5 };

test('hardwareZoomFromCapabilities', () => {
    assert.equal(hardwareZoomFromCapabilities(null), null);
    assert.equal(hardwareZoomFromCapabilities({}), null);
    assert.equal(hardwareZoomFromCapabilities({ zoom: { min: 1, max: 1 } }), null);
    assert.deepEqual(
        hardwareZoomFromCapabilities({ zoom: { min: 1, max: 5, step: 0.1 } }),
        { min: 1, max: 5, step: 0.1 }
    );
    assert.deepEqual(
        hardwareZoomFromCapabilities({ zoom: { min: 1, max: 5, step: 0 } }),
        { min: 1, max: 5, step: 0.1 }
    );
});

test('zoomLimits without hardware zoom (iOS)', () => {
    assert.deepEqual(zoomLimits(null), { min: 1, max: DIGITAL_ZOOM_MAX });
});

test('zoomLimits multiplies hardware max by digital max', () => {
    assert.deepEqual(zoomLimits(ANDROID, 4), { min: 1, max: 32 });
});

test('zoomLimits does not go wider than 1x', () => {
    assert.equal(zoomLimits(WIDE).min, 1);
});

test('planZoom is all digital without hardware zoom', () => {
    assert.deepEqual(planZoom(3, null), { digital: 3, hardware: null, total: 3 });
});

test('planZoom clamps', () => {
    assert.equal(planZoom(100, null).total, DIGITAL_ZOOM_MAX);
    assert.equal(planZoom(0.2, null).total, 1);
    assert.equal(planZoom(NaN, null).total, 1);
});

test('planZoom uses hardware first', () => {
    const plan = planZoom(4, ANDROID);
    assert.equal(plan.hardware, 4);
    assert.equal(plan.digital, 1);
});

test('planZoom adds digital past hardware max', () => {
    const plan = planZoom(20, ANDROID);
    assert.equal(plan.hardware, 8);
    assert.equal(plan.digital, 2.5);
    assert.equal(plan.total, 20);
});

test('planZoom snaps hardware down to a step and makes up the rest digitally', () => {
    const plan = planZoom(2.75, WIDE);
    assert.equal(plan.hardware, 2.5);
    assert.equal(plan.digital, 1.1);
    assert.ok(Math.abs(plan.hardware! * plan.digital - 2.75) < 1e-9);
});

test('planZoom never sets hardware below 1x on wide lenses', () => {
    const plan = planZoom(1, WIDE);
    assert.equal(plan.total, 1);
    assert.equal(plan.hardware, 1);
    assert.equal(plan.digital, 1);
});

test('planZoom avoids floating point dust', () => {
    assert.equal(planZoom(2.3, ANDROID).hardware, 2.3);
});

test('initialZoom', () => {
    assert.equal(initialZoom(ANDROID), 8);
    assert.equal(initialZoom(null), 2);
});

test('pinchZoom scales with finger distance', () => {
    assert.equal(pinchZoom(2, 100, 200), 4);
    assert.equal(pinchZoom(2, 100, 50), 1);
    assert.equal(pinchZoom(2, 0, 50), 2);
});

test('stepZoom', () => {
    assert.equal(stepZoom(2, 1), 3);
    assert.equal(stepZoom(3, -1), 2);
});

test('formatZoom', () => {
    assert.equal(formatZoom(1), '1.0×');
    assert.equal(formatZoom(2.345), '2.3×');
    assert.equal(formatZoom(16.4), '16×');
});
