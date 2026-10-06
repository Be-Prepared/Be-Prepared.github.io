import {
    addFix,
    clampStride,
    elapsed,
    estimateSteps,
    Fix,
    FixResult,
    formatDuration,
    formatPace,
    haversine,
    METERS_PER_MILE,
    newStopwatch,
    newTrack,
    pauseTrack,
    startStopwatch,
    stopStopwatch,
    STRIDE_DEFAULT,
    Track,
} from './track';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const METERS_PER_DEGREE = (6371008.8 * Math.PI) / 180;
const START = { lat: 45, lon: -93 };

// A fix offset from START by the given meters north and east.
function fixAt(
    north: number,
    east: number,
    seconds: number,
    accuracy = 5
): Fix {
    return {
        lat: START.lat + north / METERS_PER_DEGREE,
        lon:
            START.lon +
            east /
                (METERS_PER_DEGREE * Math.cos((START.lat * Math.PI) / 180)),
        accuracy,
        timestamp: seconds * 1000,
    };
}

function run(fixes: Fix[], track: Track = newTrack()) {
    const results: FixResult[] = [];

    for (const fix of fixes) {
        const next = addFix(track, fix);
        track = next.track;
        results.push(next.result);
    }

    return { track, results };
}

// Repeatable pseudo-random numbers.
function random(seed: number) {
    return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;

        return seed / 2147483648;
    };
}

test('haversine', () => {
    assert.equal(haversine(START, START), 0);
    const d = haversine(fixAt(0, 0, 0), fixAt(100, 0, 0));
    assert.ok(Math.abs(d - 100) < 0.01);
    const e = haversine(fixAt(0, 0, 0), fixAt(30, 40, 0));
    assert.ok(Math.abs(e - 50) < 0.01);
});

test('first fix only anchors', () => {
    const { track, results } = run([fixAt(0, 0, 0)]);
    assert.deepEqual(results, [FixResult.ANCHORED]);
    assert.equal(track.distance, 0);
});

test('inaccurate fixes are ignored', () => {
    const { track, results } = run([
        fixAt(0, 0, 0, 50),
        fixAt(0, 0, 1, 5),
        fixAt(100, 0, 20, 31),
        fixAt(0, 0, 21, NaN),
    ]);
    assert.deepEqual(results, [
        FixResult.INACCURATE,
        FixResult.ANCHORED,
        FixResult.INACCURATE,
        FixResult.INACCURATE,
    ]);
    assert.equal(track.distance, 0);
});

test('standing still with jitter adds nothing', () => {
    const rand = random(42);
    const fixes: Fix[] = [];

    for (let i = 0; i < 600; i += 1) {
        // Wander within a quarter of the accuracy around the true position,
        // so two fixes are never more than half the accuracy apart.
        const accuracy = 8 + rand() * 20;
        const angle = rand() * Math.PI * 2;
        const radius = rand() * accuracy * 0.25;
        fixes.push(
            fixAt(
                Math.sin(angle) * radius,
                Math.cos(angle) * radius,
                i,
                accuracy
            )
        );
    }

    const { track } = run(fixes);
    assert.equal(track.distance, 0);
});

test('small wobbles below the minimum step add nothing', () => {
    const { track } = run([
        fixAt(0, 0, 0, 2),
        fixAt(2.5, 0, 1, 2),
        fixAt(0, 2.5, 2, 2),
        fixAt(-2.5, 0, 3, 2),
    ]);
    assert.equal(track.distance, 0);
});

test('walking in a straight line is counted', () => {
    const fixes: Fix[] = [];

    // 1.4 m/s for 10 minutes, one fix per second. Each step is smaller than
    // the threshold, but they add up from the anchor.
    for (let i = 0; i <= 600; i += 1) {
        fixes.push(fixAt(i * 1.4, 0, i, 5));
    }

    const { track } = run(fixes);
    assert.ok(track.distance > 840 - 3, `${track.distance}`);
    assert.ok(track.distance <= 840 + 0.01, `${track.distance}`);
});

test('walking with jitter stays close to the true distance', () => {
    const rand = random(7);
    const fixes: Fix[] = [];

    for (let i = 0; i <= 600; i += 1) {
        const north = i * 1.4 + (rand() - 0.5) * 3;
        const east = (rand() - 0.5) * 3;
        fixes.push(fixAt(north, east, i, 6));
    }

    // Sideways noise makes each counted segment a bit longer than the real
    // path, so expect a small overcount but nothing runaway.
    const { track } = run(fixes);
    assert.ok(track.distance > 840 * 0.97, `${track.distance}`);
    assert.ok(track.distance < 840 * 1.1, `${track.distance}`);
});

test('a better fix replaces the anchor while still', () => {
    const first = addFix(newTrack(), fixAt(0, 0, 0, 25));
    const second = addFix(first.track, fixAt(5, 0, 1, 4));
    assert.equal(second.result, FixResult.STILL);
    assert.equal(second.track.anchor?.accuracy, 4);
    assert.equal(second.track.distance, 0);
});

test('impossible jumps are ignored', () => {
    const { track, results } = run([
        fixAt(0, 0, 0),
        fixAt(500, 0, 1),
        fixAt(10, 0, 5),
    ]);
    assert.deepEqual(results, [
        FixResult.ANCHORED,
        FixResult.JUMP,
        FixResult.MOVED,
    ]);
    assert.ok(Math.abs(track.distance - 10) < 0.01);
});

test('pausing forgets the anchor', () => {
    let { track } = run([fixAt(0, 0, 0), fixAt(10, 0, 10)]);
    assert.ok(Math.abs(track.distance - 10) < 0.01);
    track = pauseTrack(track);
    assert.equal(track.anchor, null);
    // Walked 200 m while paused; only movement after resuming counts.
    ({ track } = run([fixAt(210, 0, 300), fixAt(220, 0, 310)], track));
    assert.ok(Math.abs(track.distance - 20) < 0.01, `${track.distance}`);
});

test('stopwatch only runs while started', () => {
    let watch = newStopwatch();
    assert.equal(elapsed(watch, 1000), 0);
    watch = startStopwatch(watch, 1000);
    assert.equal(elapsed(watch, 4000), 3000);
    // Starting again does nothing.
    watch = startStopwatch(watch, 3000);
    assert.equal(elapsed(watch, 4000), 3000);
    watch = stopStopwatch(watch, 5000);
    assert.equal(elapsed(watch, 60000), 4000);
    watch = startStopwatch(watch, 70000);
    assert.equal(elapsed(watch, 71000), 5000);
});

test('formatDuration', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(5999), '0:05');
    assert.equal(formatDuration(754000), '12:34');
    assert.equal(formatDuration(3723000), '1:02:03');
    assert.equal(formatDuration(-5), '0:00');
});

test('formatPace', () => {
    // 1 km in 10 minutes
    assert.equal(formatPace(1000, 600000, 1000), '10:00');
    // Same pace per mile
    assert.equal(formatPace(1000, 600000, METERS_PER_MILE), '16:05');
    assert.equal(formatPace(5, 600000, 1000), '');
    assert.equal(formatPace(1000, 0, 1000), '');
    assert.equal(formatPace(11, 36000000, 1000), '');
});

test('estimateSteps and clampStride', () => {
    assert.equal(estimateSteps(750, 0.75), 1000);
    assert.equal(estimateSteps(750, 0), 0);
    assert.equal(clampStride(null), STRIDE_DEFAULT);
    assert.equal(clampStride(NaN), STRIDE_DEFAULT);
    assert.equal(clampStride(0.1), 0.3);
    assert.equal(clampStride(3), 1.5);
    assert.equal(clampStride(0.8), 0.8);
});
