import {
    ACCURACY_68_TO_SIGMA,
    AverageSample,
    averageSamples,
    BIAS_SHARE,
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

// Seeded so the statistical tests are repeatable (mulberry32 + Box-Muller).
function makeRandom(seed: number) {
    let a = seed >>> 0;
    const uniform = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const normal = () =>
        Math.sqrt(-2 * Math.log(1 - uniform())) *
        Math.cos(2 * Math.PI * uniform());

    return { uniform, normal };
}

// One fix per second for `minutes`: Gauss-Markov errors with the given
// per-axis sigma (m) and time constant (s), plus white noise. The reported
// accuracy is the honest 68% radius of the total.
function stream(
    random: ReturnType<typeof makeRandom>,
    minutes: number,
    components: [number, number][],
    white: number
) {
    const state = components.map(([sigma]) => [
        sigma * random.normal(),
        sigma * random.normal(),
    ]);
    const total = Math.sqrt(
        components.reduce((sum, [sigma]) => sum + sigma * sigma, white * white)
    );
    const fixes: AverageSample[] = [];

    for (let t = 0; t < minutes * 60; t += 1) {
        let east = white * random.normal();
        let north = white * random.normal();

        components.forEach(([sigma, tau], index) => {
            const phi = Math.exp(-1 / tau);
            const kick = sigma * Math.sqrt(1 - phi * phi);
            state[index][0] = phi * state[index][0] + kick * random.normal();
            state[index][1] = phi * state[index][1] + kick * random.normal();
            east += state[index][0];
            north += state[index][1];
        });
        fixes.push(
            sample(east, north, Math.round(total * ACCURACY_68_TO_SIGMA), t * 1000)
        );
    }

    return fixes;
}

test('no samples gives no result', () => {
    assert.equal(averageSamples([]), null);
    assert.equal(averageSamples([sample(NaN, 0, 5, 0)]), null);
});

test('a single fix converts its 68% accuracy to a 95% radius', () => {
    const result = averageSamples([sample(3, 4, 10, 0)])!;

    assert.ok(close(result.y, 3));
    assert.ok(close(result.z, 4));
    assert.ok(close(result.effectiveCount, 1));
    // About 1.62 times the 68% radius.
    assert.ok(
        close(result.radius95, (10 / ACCURACY_68_TO_SIGMA) * SIGMA_TO_RADIUS_95)
    );
});

test('multipath jumps barely move the average', () => {
    const random = makeRandom(1);
    const fixes: AverageSample[] = [];

    for (let t = 0; t < 1200; t += 1) {
        // A minute-long jump 40 m east every five minutes, which the
        // receiver doesn't flag: 20% of the fixes.
        const jump = t % 300 >= 240 ? 40 : 0;
        fixes.push(
            sample(jump + 2 * random.normal(), 2 * random.normal(), 5, t * 1000)
        );
    }

    const result = averageSamples(fixes)!;
    const plainMean =
        fixes.reduce((sum, fix) => sum + fix.y, 0) / fixes.length;

    assert.ok(plainMean > 7);
    assert.ok(Math.abs(result.y) < 1.5, `east ${result.y}`);
    assert.ok(Math.abs(result.z) < 0.5);
});

test('fixes with much worse reported accuracy are left out', () => {
    const fixes: AverageSample[] = [];

    for (let t = 0; t < 120; t += 1) {
        fixes.push(sample(0, 0, 5, t * 1000));
    }

    // A network fix 300 m away claiming 500 m.
    fixes.push(sample(300, 0, 500, 120000));
    const result = averageSamples(fixes)!;

    assert.equal(result.rejectedCount, 1);
    assert.equal(result.usedCount, 120);
    assert.ok(close(result.y, 0));
});

test('accuracy improves with time spent but levels off', () => {
    const atMinutes = (minutes: number) => {
        const fixes: AverageSample[] = [];

        for (let t = 0; t < minutes * 60; t += 1) {
            fixes.push(sample(0, 0, 8, t * 1000));
        }

        return averageSamples(fixes)!.radius95;
    };

    const single = averageSamples([sample(0, 0, 8, 0)])!.radius95;
    const ten = atMinutes(10);
    const sixty = atMinutes(60);
    const twoHours = atMinutes(120);
    const day = atMinutes(24 * 60);

    assert.ok(ten < single);
    assert.ok(sixty < ten);
    assert.ok(twoHours < sixty);
    // The part assumed not to average away keeps a floor under it.
    assert.ok(day > single * Math.sqrt(BIAS_SHARE));
    assert.ok(day < single * Math.sqrt(BIAS_SHARE) * 1.2);
});

test('the observed scatter wins when accuracy is understated', () => {
    // Fixes claim 1 m but are spread over a 30 m circle.
    const fixes: AverageSample[] = [];

    for (let t = 0; t < 1800; t += 1) {
        const angle = t * 2.39996;
        fixes.push(
            sample(30 * Math.cos(angle), 30 * Math.sin(angle), 1, t * 1000)
        );
    }

    const result = averageSamples(fixes)!;

    assert.ok(result.fixSigma > 20);
    assert.ok(result.radius95 > 20);
});

test('works away from the equator and at a pole', () => {
    // On a sphere at 60° N, 100° E: two fixes 10 m east and west of a spot.
    const lat = (60 * Math.PI) / 180;
    const lon = (100 * Math.PI) / 180;
    const center = [
        R * Math.cos(lat) * Math.cos(lon),
        R * Math.cos(lat) * Math.sin(lon),
        R * Math.sin(lat),
    ];
    const east = [-Math.sin(lon), Math.cos(lon), 0];
    const at = (meters: number, timestamp: number): AverageSample => ({
        x: center[0] + meters * east[0],
        y: center[1] + meters * east[1],
        z: center[2] + meters * east[2],
        accuracy: 5,
        timestamp,
    });
    const result = averageSamples([at(-10, 0), at(10, 1000)])!;

    assert.ok(close(result.x, center[0], 1e-3));
    assert.ok(close(result.y, center[1], 1e-3));
    assert.ok(close(result.z, center[2], 1e-3));

    const pole = averageSamples([
        { x: 0, y: 0, z: R, accuracy: 5, timestamp: 0 },
        { x: 4, y: 0, z: R, accuracy: 5, timestamp: 1000 },
    ])!;

    assert.ok(close(pole.x, 2, 1e-6));
    assert.ok(isFinite(pole.radius95));
});

test('the 95% radius holds the truth about 95% of the time', () => {
    // Multipath-like wander with a 10 minute time constant, a slower
    // error over an hour, receiver noise, and white noise. The old method
    // (10 minute correlation, no shared-error correction) covers 74% to 79%
    // here depending on the seed; this one covers 92% to 93%.
    const random = makeRandom(12345);
    const runs = 150;
    let covered = 0;

    for (let run = 0; run < runs; run += 1) {
        const fixes = stream(
            random,
            30,
            [
                [0.7, 3600],
                [2, 600],
                [0.6, 10],
            ],
            0.3
        );
        const result = averageSamples(fixes)!;

        if (Math.hypot(result.y, result.z) <= result.radius95) {
            covered += 1;
        }
    }

    const coverage = covered / runs;

    assert.ok(coverage > 0.88 && coverage <= 1, `coverage ${coverage}`);
    // And it isn't simply a huge radius that always covers.
    assert.ok(coverage < 1, `coverage ${coverage}`);
});
