import { AccessState } from '../services/access/access-controller';
import {
    addReading,
    BASELINE_SAMPLES,
    classifySensorError,
    delta,
    Detector,
    fieldStrength,
    formatMicrotesla,
    FULL_SCALE_DELTA,
    gaugeFraction,
    newDetector,
    Strength,
    strengthFor,
    toneFor,
    zero,
} from './detector';
import assert from 'node:assert/strict';
import { test } from 'node:test';

function feed(detector: Detector, values: number[]) {
    for (const value of values) {
        detector = addReading(detector, value);
    }

    return detector;
}

test('fieldStrength', () => {
    assert.equal(fieldStrength(3, 4, 0), 5);
    assert.equal(fieldStrength(0, 0, 0), 0);
    assert.ok(Math.abs(fieldStrength(20, -30, 40) - 53.8516) < 0.001);
});

test('baseline is the median of the first readings', () => {
    let detector = feed(newDetector(), [50, 50, 50, 50]);
    assert.equal(detector.baseline, null);
    assert.equal(delta(detector), null);
    // One wild reading doesn't move the median.
    detector = feed(detector, [500, 50, 50, 50, 50, 50]);
    assert.equal(detector.pending.length, 0);
    assert.equal(detector.baseline, 50);
    assert.equal(BASELINE_SAMPLES, 10);
});

test('delta follows the smoothed field', () => {
    let detector = feed(newDetector(), new Array(10).fill(50));
    assert.equal(delta(detector), 0);
    // A steady change is reached after a few readings.
    detector = feed(detector, new Array(30).fill(80));
    assert.ok(Math.abs((delta(detector) as number) - 30) < 0.01);
    // Weaker fields give a negative change.
    detector = feed(detector, new Array(30).fill(40));
    assert.ok(Math.abs((delta(detector) as number) + 10) < 0.01);
});

test('smoothing hides a single spike', () => {
    let detector = feed(newDetector(), new Array(10).fill(50));
    detector = addReading(detector, 150);
    assert.ok((delta(detector) as number) < 40);
});

test('invalid readings are ignored', () => {
    const detector = feed(newDetector(), new Array(10).fill(50));
    assert.equal(addReading(detector, NaN), detector);
});

test('zero makes the current field the baseline', () => {
    let detector = feed(newDetector(), new Array(10).fill(50));
    detector = feed(detector, new Array(40).fill(120));
    assert.ok((delta(detector) as number) > 69);
    detector = zero(detector);
    assert.equal(delta(detector), 0);
    detector = feed(detector, new Array(40).fill(50));
    assert.ok(Math.abs((delta(detector) as number) + 70) < 0.01);
});

test('zero before any reading waits for one', () => {
    const detector = zero(newDetector());
    assert.equal(detector.baseline, null);
    assert.equal(addReading(detector, 42).baseline, null);
});

test('gaugeFraction', () => {
    assert.equal(gaugeFraction(null), 0);
    assert.equal(gaugeFraction(0), 0);
    assert.equal(gaugeFraction(FULL_SCALE_DELTA), 1);
    assert.equal(gaugeFraction(5000), 1);
    assert.equal(gaugeFraction(-20), gaugeFraction(20));
    // Logarithmic: small changes still move the gauge.
    assert.ok(gaugeFraction(5) > 0.3);
    assert.ok(gaugeFraction(20) < gaugeFraction(100));
});

test('toneFor', () => {
    assert.equal(toneFor(null), null);
    assert.equal(toneFor(0), null);
    assert.equal(toneFor(2.9), null);
    assert.equal(toneFor(-2.9), null);
    const weak = toneFor(5);
    const strong = toneFor(200);
    const full = toneFor(10000);

    if (!weak || !strong || !full) {
        assert.fail('Expected a tone for each change');
    }

    // Higher and faster as the change grows.
    assert.ok(strong.frequency > weak.frequency);
    assert.ok(strong.interval < weak.interval);
    assert.deepEqual(full, { frequency: 1500, interval: 80 });
    assert.deepEqual(toneFor(-200), strong);
});

test('strengthFor', () => {
    assert.equal(strengthFor(null), Strength.NONE);
    assert.equal(strengthFor(1), Strength.NONE);
    assert.equal(strengthFor(-10), Strength.WEAK);
    assert.equal(strengthFor(50), Strength.MEDIUM);
    assert.equal(strengthFor(-150), Strength.STRONG);
});

test('formatMicrotesla', () => {
    assert.equal(formatMicrotesla(null), '—');
    assert.equal(formatMicrotesla(48.25), '48.3 µT');
    assert.equal(formatMicrotesla(12.34, true), '+12.3 µT');
    assert.equal(formatMicrotesla(-5, true), '−5.0 µT');
    assert.equal(formatMicrotesla(-0.01, true), '0.0 µT');
});

test('classifySensorError', () => {
    assert.equal(classifySensorError({ name: 'NotAllowedError' }), AccessState.DENIED);
    assert.equal(classifySensorError({ name: 'SecurityError' }), AccessState.DENIED);
    assert.equal(
        classifySensorError({ name: 'NotReadableError' }),
        AccessState.UNAVAILABLE
    );
    assert.equal(
        classifySensorError({ name: 'NotSupportedError' }),
        AccessState.UNAVAILABLE
    );
    assert.equal(classifySensorError({ name: 'AbortError' }), AccessState.ERROR);
    assert.equal(classifySensorError(null), AccessState.ERROR);
});
