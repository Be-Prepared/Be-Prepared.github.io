import {
    ACCURACY_68_TO_SIGMA,
    AverageSample,
    averageSamples,
    CORRELATION_MS,
    SIGMA_TO_RADIUS_95,
} from './location-average-math';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// A spot on the equator at longitude 0: ECEF x is the Earth's radius, and
// y (east) and z (north) are local horizontal axes.
const R = 6378137;

function sample(
    east: number,
    north: number,
    accuracy: number,
    timestamp: number
): AverageSample {
    return { x: R, y: east, z: north, accuracy, timestamp };
}

const close = (a: number, b: number, epsilon = 1e-6) =>
    Math.abs(a - b) < epsilon;

test('no samples gives no result', () => {
    assert.equal(averageSamples([]), null);
});

test('a single fix converts its 68% accuracy to a 95% radius', () => {
    const result = averageSamples([sample(0, 0, 10, 0)])!;

    assert.ok(close(result.y, 0));
    assert.ok(close(result.effectiveCount, 1));
    // About 1.62 times the 68% radius.
    assert.ok(
        close(result.radius95, (10 / ACCURACY_68_TO_SIGMA) * SIGMA_TO_RADIUS_95)
    );
    assert.ok(result.radius95 > 16 && result.radius95 < 16.5);
});

test('inverse-variance weighting favors the more accurate fix', () => {
    // A 5 m fix has four times the weight of a 10 m fix.
    const result = averageSamples([
        sample(0, 0, 5, 0),
        sample(10, 0, 10, 1000),
    ])!;

    assert.ok(close(result.y, 2));
    assert.ok(close(result.z, 0));
});

test('many fixes in a short time barely improve the accuracy', () => {
    const fixes: AverageSample[] = [];

    for (let i = 0; i < 600; i += 1) {
        fixes.push(sample(0, 0, 10, i * 1000));
    }

    const result = averageSamples(fixes)!;
    const single = averageSamples([fixes[0]])!;

    // Ten minutes is about two independent samples, not 600.
    assert.ok(close(result.effectiveCount, 1 + 599000 / CORRELATION_MS));
    assert.ok(result.radius95 > single.radius95 / Math.sqrt(2.1));
});

test('accuracy improves with time spent', () => {
    const atMinutes = (minutes: number) => {
        const fixes: AverageSample[] = [];

        for (let t = 0; t <= minutes * 60; t += 1) {
            fixes.push(sample(0, 0, 8, t * 1000));
        }

        return averageSamples(fixes)!.radius95;
    };

    const ten = atMinutes(10);
    const sixty = atMinutes(60);
    const twoHours = atMinutes(120);

    assert.ok(sixty < ten);
    assert.ok(twoHours < sixty);
    // n_eff goes from 7 to 13 between one and two hours.
    assert.ok(close(sixty / twoHours, Math.sqrt(13 / 7), 1e-3));
});

test('the observed scatter sets a floor when accuracy is understated', () => {
    // Fixes claim 1 m but are spread over +/- 30 m.
    const fixes: AverageSample[] = [];

    for (let i = 0; i < 100; i += 1) {
        fixes.push(sample(i % 2 ? 30 : -30, 0, 1, i * 60000));
    }

    const result = averageSamples(fixes)!;

    assert.ok(close(result.y, 0, 1e-6));
    assert.ok(result.empiricalSigma > result.modelSigma);
    // Per-axis spread is 30 / sqrt(2) (the scatter is all east-west), with
    // a small n / (n - 1) correction, over sqrt(n_eff).
    const expected =
        Math.sqrt(((900 / 2) * 100) / 99 / result.effectiveCount) *
        SIGMA_TO_RADIUS_95;
    assert.ok(close(result.radius95, expected, 1e-6));
});

test('missing accuracy falls back to a default', () => {
    const result = averageSamples([
        sample(0, 0, 0, 0),
        sample(0, 0, NaN, 1000),
    ])!;

    assert.ok(isFinite(result.radius95));
    assert.ok(result.radius95 > 0);
});
