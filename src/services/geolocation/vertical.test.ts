import {
    altitudeThreshold,
    ascentSummary,
    descentSummary,
    glideRatio,
    initialVerticalState,
    updateVertical,
    VerticalFix,
    VerticalState,
} from './vertical';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Deterministic noise in [-1, 1].
function noise(i: number) {
    const s = Math.sin(i * 12.9898) * 43758.5453;

    return (s - Math.floor(s)) * 2 - 1;
}

function run(fixes: Partial<VerticalFix>[]): VerticalState {
    let state = initialVerticalState();

    fixes.forEach((fix, i) => {
        state = updateVertical(state, {
            timestamp: i * 1000,
            altitude: null,
            altitudeAccuracy: null,
            distanceTraveled: 0,
            ...fix,
        });
    });

    return state;
}

// One fix per second following `altitudeAt(seconds)`.
function track(seconds: number, altitudeAt: (t: number) => number) {
    const fixes: Partial<VerticalFix>[] = [];

    for (let t = 0; t <= seconds; t += 1) {
        fixes.push({ timestamp: t * 1000, altitude: altitudeAt(t) });
    }

    return fixes;
}

test('altitudeThreshold clamps the reported accuracy', () => {
    assert.equal(altitudeThreshold(null), 5);
    assert.equal(altitudeThreshold(0), 5);
    assert.equal(altitudeThreshold(1), 3);
    assert.equal(altitudeThreshold(7), 7);
    assert.equal(altitudeThreshold(40), 10);
});

test('noise while standing still is not counted as climbing', () => {
    // An hour at 100 m with +/- 8 m of jitter on every fix.
    const state = run(track(3600, (t) => 100 + 8 * noise(t)));
    const ascent = ascentSummary(state);
    const descent = descentSummary(state);

    // Naively summing the jitter would give thousands of meters.
    assert.ok(ascent.total < 40, `ascent ${ascent.total}`);
    assert.ok(descent.total < 40, `descent ${descent.total}`);
});

test('a steady climb and descent are measured', () => {
    // Climb 300 m at 0.5 m/s, rest 5 minutes, descend at 1 m/s, then stop
    // so the smoothing catches up.
    const state = run(
        track(600 + 300 + 300 + 60, (t) => {
            let altitude: number;

            if (t <= 600) {
                altitude = 1000 + 0.5 * t;
            } else if (t <= 900) {
                altitude = 1300;
            } else {
                altitude = Math.max(1000, 1300 - (t - 900));
            }

            return altitude + 2 * noise(t);
        })
    );
    const ascent = ascentSummary(state);
    const descent = descentSummary(state);

    assert.ok(Math.abs(ascent.total - 300) < 10, `ascent ${ascent.total}`);
    assert.ok(Math.abs(descent.total - 300) < 15, `descent ${descent.total}`);
    assert.ok(
        Math.abs(ascent.average - 0.5) < 0.1,
        `ascent avg ${ascent.average}`
    );
    assert.ok(
        Math.abs(descent.average - 1) < 0.2,
        `descent avg ${descent.average}`
    );
    assert.ok(ascent.minimum <= ascent.average);
    assert.ok(ascent.maximum >= ascent.average);
    assert.ok(ascent.maximum < 1, `ascent max ${ascent.maximum}`);
    assert.ok(descent.maximum < 2, `descent max ${descent.maximum}`);
});

test('the rest at the summit is not counted as climbing time', () => {
    // Climb 100 m in 200 s, then sit on top with noise for half an hour.
    const state = run(
        track(200 + 1800, (t) =>
            t <= 200 ? 0.5 * t : 100 + 2.5 * noise(t)
        )
    );
    const ascent = ascentSummary(state);

    assert.ok(ascent.average > 0.35, `ascent avg ${ascent.average}`);
});

test('vertical speed follows the smoothed altitude', () => {
    const climbing = run(track(120, (t) => 0.5 * t));
    assert.ok(Math.abs(climbing.verticalSpeed - 0.5) < 0.02);

    const descending = run(track(120, (t) => 500 - 2 * t));
    assert.ok(Math.abs(descending.verticalSpeed + 2) < 0.1);

    assert.ok(isNaN(run(track(0, () => 10)).verticalSpeed));
});

test('fixes without altitude or repeated timestamps are ignored', () => {
    const state = run([
        { altitude: 10 },
        { altitude: null },
        { altitude: NaN },
    ]);

    assert.equal(state.lastTimestamp, 0);
    assert.equal(state.smoothedAltitude, 10);

    const repeated = updateVertical(state, {
        timestamp: 0,
        altitude: 50,
        altitudeAccuracy: null,
        distanceTraveled: 0,
    });
    assert.equal(repeated, state);
});

test('summaries are empty before anything happens', () => {
    const summary = ascentSummary(initialVerticalState());

    assert.equal(summary.total, 0);
    assert.ok(isNaN(summary.average));
    assert.ok(isNaN(summary.minimum));
    assert.ok(isNaN(summary.maximum));
});

test('glide ratio while descending', () => {
    // 10 m/s forward, 1 m/s down: 10:1.
    const fixes: Partial<VerticalFix>[] = [];

    for (let t = 0; t <= 120; t += 1) {
        fixes.push({
            timestamp: t * 1000,
            altitude: 1000 - t,
            distanceTraveled: 10 * t,
        });
    }

    const ratio = glideRatio(run(fixes));
    assert.ok(Math.abs(ratio - 10) < 0.2, `ratio ${ratio}`);
});

test('glide ratio is undefined when level or climbing', () => {
    const level: Partial<VerticalFix>[] = [];
    const climbing: Partial<VerticalFix>[] = [];

    for (let t = 0; t <= 120; t += 1) {
        level.push({ altitude: 500, distanceTraveled: 10 * t });
        climbing.push({ altitude: 500 + t, distanceTraveled: 10 * t });
    }

    assert.ok(isNaN(glideRatio(run(level))));
    assert.ok(isNaN(glideRatio(run(climbing))));
    assert.ok(isNaN(glideRatio(initialVerticalState())));
});
