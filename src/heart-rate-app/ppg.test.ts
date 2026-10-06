import {
    bandPass,
    detectPeaks,
    estimateBpm,
    frameStats,
    GOOD_QUALITY,
    isFingerPresent,
    lastSeconds,
    resample,
    Sample,
    summarize,
    waveform,
} from './ppg';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Deterministic noise so tests never flake.
function random(seed: number) {
    return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;

        return seed / 4294967296;
    };
}

// Camera-like signal: a pulse riding on a large brightness level with slow
// drift, noise and slightly uneven frame times.
function pulse(
    bpm: number,
    options: {
        drift?: number;
        noise?: number;
        seconds?: number;
        seed?: number;
    } = {}
): Sample[] {
    const rand = random(options.seed || 1);
    const seconds = options.seconds || 12;
    const samples: Sample[] = [];
    let t = 1000;

    while (t < 1000 + seconds * 1000) {
        const s = (t - 1000) / 1000;
        const phase = (2 * Math.PI * bpm * s) / 60;
        // Fundamental plus a dicrotic-notch-like harmonic.
        const beat = Math.sin(phase) + 0.3 * Math.sin(2 * phase + 1);
        const v =
            200 +
            beat +
            (options.drift || 0) * s +
            3 * Math.sin(0.2 * s) +
            (rand() - 0.5) * 2 * (options.noise || 0);
        samples.push({ t, v });
        t += 33.3 + (rand() - 0.5) * 8;
    }

    return samples;
}

function noise(seconds: number, seed: number): Sample[] {
    const rand = random(seed);
    const samples: Sample[] = [];

    for (let t = 0; t < seconds * 1000; t += 33.3) {
        samples.push({ t, v: 200 + (rand() - 0.5) * 4 });
    }

    return samples;
}

test('frameStats averages channels', () => {
    const data = [200, 10, 20, 255, 100, 30, 40, 255];
    const stats = frameStats(data);
    assert.equal(stats.red, 150);
    assert.equal(stats.green, 20);
    assert.equal(stats.blue, 30);
    assert.equal(stats.redSpread, 50);
    assert.deepEqual(frameStats([]), { red: 0, green: 0, blue: 0, redSpread: 0 });
});

test('isFingerPresent', () => {
    assert.ok(isFingerPresent({ red: 220, green: 40, blue: 30, redSpread: 5 }));
    // A gray room.
    assert.equal(
        isFingerPresent({ red: 120, green: 110, blue: 100, redSpread: 40 }), false
    );
    // Dark.
    assert.equal(isFingerPresent({ red: 20, green: 2, blue: 2, redSpread: 2 }), false);
    // Partly covered lens: red but uneven.
    assert.equal(isFingerPresent({ red: 150, green: 40, blue: 30, redSpread: 70 }), false);
});

test('resample makes an even grid ending at the last sample', () => {
    const result = resample(
        [
            { t: 0, v: 0 },
            { t: 100, v: 10 },
        ],
        20
    );
    assert.deepEqual(result, [0, 5, 10]);
    assert.deepEqual(resample([{ t: 0, v: 1 }]), []);
});

test('bandPass removes a constant and drift', () => {
    const values = Array.from({ length: 300 }, (_, i) => 100 + i * 0.5);
    const filtered = bandPass(values);
    const middle = filtered.slice(60, 240);
    assert.ok(Math.max(...middle.map(Math.abs)) < 0.5);
});

test('detectPeaks honors the refractory gap', () => {
    const values = [0, 1, 0, 2, 0, 0, 0, 0, 3, 0, 1, 0];
    assert.deepEqual(detectPeaks(values, 4), [3, 8]);
});

for (const bpm of [45, 60, 72, 90, 120, 150, 180, 200]) {
    test(`estimateBpm finds ${bpm} BPM with noise and drift`, () => {
        const estimate = estimateBpm(
            pulse(bpm, { drift: 2, noise: 0.6, seed: bpm })
        );
        assert.ok(
            Math.abs(estimate.bpm - bpm) <= 3,
            `got ${estimate.bpm.toFixed(1)}`
        );
        assert.ok(
            estimate.quality >= GOOD_QUALITY,
            `quality ${estimate.quality.toFixed(2)}`
        );
    });
}

test('estimateBpm does not halve a fast pulse in heavy noise', () => {
    const estimate = estimateBpm(pulse(120, { noise: 1.5, seed: 120 }));
    assert.ok(Math.abs(estimate.bpm - 120) <= 3, `got ${estimate.bpm.toFixed(1)}`);
});

test('estimateBpm does not double a pulse with a strong second harmonic', () => {
    const samples: Sample[] = [];

    for (let time = 0; time < 10000; time += 33.3) {
        const phase = (2 * Math.PI * 60 * time) / 60000;
        samples.push({
            t: time,
            v: 200 + Math.sin(phase) + 0.9 * Math.sin(2 * phase + 1),
        });
    }

    assert.ok(Math.abs(estimateBpm(samples).bpm - 60) <= 3);
});

test('estimateBpm gives low quality for a flat signal', () => {
    const flat = Array.from({ length: 300 }, (_, i) => ({ t: i * 33, v: 180 }));
    assert.equal(estimateBpm(flat).quality, 0);
});

test('estimateBpm gives low quality for noise', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
        const estimate = estimateBpm(noise(12, seed));
        assert.ok(
            estimate.quality < GOOD_QUALITY,
            `seed ${seed} quality ${estimate.quality.toFixed(2)}`
        );
    }
});

test('estimateBpm needs enough signal', () => {
    assert.equal(estimateBpm(pulse(70, { seconds: 3 })).quality, 0);
    assert.equal(estimateBpm([]).quality, 0);
});

test('lastSeconds keeps the newest window', () => {
    const samples = [0, 1000, 2000, 3000].map((time) => ({ t: time, v: 0 }));
    assert.deepEqual(
        lastSeconds(samples, 2).map((s) => s.t),
        [1000, 2000, 3000]
    );
});

test('waveform is scaled to -1..1', () => {
    const wave = waveform(pulse(70), 5);
    assert.equal(wave.length, 150);
    assert.equal(Math.max(...wave.map(Math.abs)), 1);
});

test('summarize takes the median of good estimates', () => {
    assert.equal(
        summarize([
            { bpm: 70, quality: 0.9 },
            { bpm: 72, quality: 0.8 },
            { bpm: 140, quality: 0.1 },
            { bpm: 71.4, quality: 0.7 },
        ]),
        71
    );
    assert.equal(summarize([{ bpm: 70, quality: 0.9 }]), null);
});
