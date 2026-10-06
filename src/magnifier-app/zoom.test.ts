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
import test from 'ava';

const ANDROID = { min: 1, max: 8, step: 0.1 };
const WIDE = { min: 0.5, max: 10, step: 0.5 };

test('hardwareZoomFromCapabilities', (t) => {
    t.is(hardwareZoomFromCapabilities(null), null);
    t.is(hardwareZoomFromCapabilities({}), null);
    t.is(hardwareZoomFromCapabilities({ zoom: { min: 1, max: 1 } }), null);
    t.deepEqual(
        hardwareZoomFromCapabilities({ zoom: { min: 1, max: 5, step: 0.1 } }),
        { min: 1, max: 5, step: 0.1 }
    );
    t.deepEqual(
        hardwareZoomFromCapabilities({ zoom: { min: 1, max: 5, step: 0 } }),
        { min: 1, max: 5, step: 0.1 }
    );
});

test('zoomLimits without hardware zoom (iOS)', (t) => {
    t.deepEqual(zoomLimits(null), { min: 1, max: DIGITAL_ZOOM_MAX });
});

test('zoomLimits multiplies hardware max by digital max', (t) => {
    t.deepEqual(zoomLimits(ANDROID, 4), { min: 1, max: 32 });
});

test('zoomLimits does not go wider than 1x', (t) => {
    t.is(zoomLimits(WIDE).min, 1);
});

test('planZoom is all digital without hardware zoom', (t) => {
    t.deepEqual(planZoom(3, null), { digital: 3, hardware: null, total: 3 });
});

test('planZoom clamps', (t) => {
    t.is(planZoom(100, null).total, DIGITAL_ZOOM_MAX);
    t.is(planZoom(0.2, null).total, 1);
    t.is(planZoom(NaN, null).total, 1);
});

test('planZoom uses hardware first', (t) => {
    const plan = planZoom(4, ANDROID);
    t.is(plan.hardware, 4);
    t.is(plan.digital, 1);
});

test('planZoom adds digital past hardware max', (t) => {
    const plan = planZoom(20, ANDROID);
    t.is(plan.hardware, 8);
    t.is(plan.digital, 2.5);
    t.is(plan.total, 20);
});

test('planZoom snaps hardware down to a step and makes up the rest digitally', (t) => {
    const plan = planZoom(2.75, WIDE);
    t.is(plan.hardware, 2.5);
    t.is(plan.digital, 1.1);
    t.true(Math.abs(plan.hardware! * plan.digital - 2.75) < 1e-9);
});

test('planZoom never sets hardware below 1x on wide lenses', (t) => {
    const plan = planZoom(1, WIDE);
    t.is(plan.total, 1);
    t.is(plan.hardware, 1);
    t.is(plan.digital, 1);
});

test('planZoom avoids floating point dust', (t) => {
    t.is(planZoom(2.3, ANDROID).hardware, 2.3);
});

test('initialZoom', (t) => {
    t.is(initialZoom(ANDROID), 8);
    t.is(initialZoom(null), 2);
});

test('pinchZoom scales with finger distance', (t) => {
    t.is(pinchZoom(2, 100, 200), 4);
    t.is(pinchZoom(2, 100, 50), 1);
    t.is(pinchZoom(2, 0, 50), 2);
});

test('stepZoom', (t) => {
    t.is(stepZoom(2, 1), 3);
    t.is(stepZoom(3, -1), 2);
});

test('formatZoom', (t) => {
    t.is(formatZoom(1), '1.0×');
    t.is(formatZoom(2.345), '2.3×');
    t.is(formatZoom(16.4), '16×');
});
