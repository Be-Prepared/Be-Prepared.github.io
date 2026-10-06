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
import test from 'ava';

function feed(detector: Detector, values: number[]) {
    for (const value of values) {
        detector = addReading(detector, value);
    }

    return detector;
}

test('fieldStrength', (t) => {
    t.is(fieldStrength(3, 4, 0), 5);
    t.is(fieldStrength(0, 0, 0), 0);
    t.true(Math.abs(fieldStrength(20, -30, 40) - 53.8516) < 0.001);
});

test('baseline is the median of the first readings', (t) => {
    let detector = feed(newDetector(), [50, 50, 50, 50]);
    t.is(detector.baseline, null);
    t.is(delta(detector), null);
    // One wild reading doesn't move the median.
    detector = feed(detector, [500, 50, 50, 50, 50, 50]);
    t.is(detector.pending.length, 0);
    t.is(detector.baseline, 50);
    t.is(BASELINE_SAMPLES, 10);
});

test('delta follows the smoothed field', (t) => {
    let detector = feed(newDetector(), new Array(10).fill(50));
    t.is(delta(detector), 0);
    // A steady change is reached after a few readings.
    detector = feed(detector, new Array(30).fill(80));
    t.true(Math.abs((delta(detector) as number) - 30) < 0.01);
    // Weaker fields give a negative change.
    detector = feed(detector, new Array(30).fill(40));
    t.true(Math.abs((delta(detector) as number) + 10) < 0.01);
});

test('smoothing hides a single spike', (t) => {
    let detector = feed(newDetector(), new Array(10).fill(50));
    detector = addReading(detector, 150);
    t.true((delta(detector) as number) < 40);
});

test('invalid readings are ignored', (t) => {
    const detector = feed(newDetector(), new Array(10).fill(50));
    t.is(addReading(detector, NaN), detector);
});

test('zero makes the current field the baseline', (t) => {
    let detector = feed(newDetector(), new Array(10).fill(50));
    detector = feed(detector, new Array(40).fill(120));
    t.true((delta(detector) as number) > 69);
    detector = zero(detector);
    t.is(delta(detector), 0);
    detector = feed(detector, new Array(40).fill(50));
    t.true(Math.abs((delta(detector) as number) + 70) < 0.01);
});

test('zero before any reading waits for one', (t) => {
    const detector = zero(newDetector());
    t.is(detector.baseline, null);
    t.is(addReading(detector, 42).baseline, null);
});

test('gaugeFraction', (t) => {
    t.is(gaugeFraction(null), 0);
    t.is(gaugeFraction(0), 0);
    t.is(gaugeFraction(FULL_SCALE_DELTA), 1);
    t.is(gaugeFraction(5000), 1);
    t.is(gaugeFraction(-20), gaugeFraction(20));
    // Logarithmic: small changes still move the gauge.
    t.true(gaugeFraction(5) > 0.3);
    t.true(gaugeFraction(20) < gaugeFraction(100));
});

test('toneFor', (t) => {
    t.is(toneFor(null), null);
    t.is(toneFor(0), null);
    t.is(toneFor(2.9), null);
    t.is(toneFor(-2.9), null);
    const weak = toneFor(5);
    const strong = toneFor(200);
    const full = toneFor(10000);

    if (!weak || !strong || !full) {
        t.fail();

        return;
    }

    // Higher and faster as the change grows.
    t.true(strong.frequency > weak.frequency);
    t.true(strong.interval < weak.interval);
    t.deepEqual(full, { frequency: 1500, interval: 80 });
    t.deepEqual(toneFor(-200), strong);
});

test('strengthFor', (t) => {
    t.is(strengthFor(null), Strength.NONE);
    t.is(strengthFor(1), Strength.NONE);
    t.is(strengthFor(-10), Strength.WEAK);
    t.is(strengthFor(50), Strength.MEDIUM);
    t.is(strengthFor(-150), Strength.STRONG);
});

test('formatMicrotesla', (t) => {
    t.is(formatMicrotesla(null), '—');
    t.is(formatMicrotesla(48.25), '48.3 µT');
    t.is(formatMicrotesla(12.34, true), '+12.3 µT');
    t.is(formatMicrotesla(-5, true), '−5.0 µT');
    t.is(formatMicrotesla(-0.01, true), '0.0 µT');
});

test('classifySensorError', (t) => {
    t.is(classifySensorError({ name: 'NotAllowedError' }), AccessState.DENIED);
    t.is(classifySensorError({ name: 'SecurityError' }), AccessState.DENIED);
    t.is(
        classifySensorError({ name: 'NotReadableError' }),
        AccessState.UNAVAILABLE
    );
    t.is(
        classifySensorError({ name: 'NotSupportedError' }),
        AccessState.UNAVAILABLE
    );
    t.is(classifySensorError({ name: 'AbortError' }), AccessState.ERROR);
    t.is(classifySensorError(null), AccessState.ERROR);
});
