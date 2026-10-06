import {
    aWeightingDb,
    aWeightingPowerGains,
    dbfsToSpl,
    findCategoryIndex,
    formatDb,
    formatRange,
    LevelStats,
    meanSquare,
    meanSquareToDbfs,
    MIN_DBFS,
    smooth,
    SOUND_CATEGORIES,
    weightingCorrectionDb,
} from './sound-math';
import assert from 'node:assert/strict';
import { test } from 'node:test';

function near(actual: number, expected: number, tolerance = 0.1) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${actual} is not within ${tolerance} of ${expected}`
    );
}

test('meanSquare', () => {
    assert.equal(meanSquare([]), 0);
    assert.equal(meanSquare([1, -1, 1, -1]), 1);
    assert.equal(meanSquare([0.5, -0.5]), 0.25);
});

test('meanSquareToDbfs: full scale sine is 0 dBFS', () => {
    const samples = new Float32Array(48000);

    for (let i = 0; i < samples.length; i += 1) {
        samples[i] = Math.sin((2 * Math.PI * 1000 * i) / 48000);
    }

    near(meanSquareToDbfs(meanSquare(samples)), 0, 0.01);
});

test('meanSquareToDbfs: half amplitude is -6 dB, silence is clamped', () => {
    near(meanSquareToDbfs(0.125), -6.02, 0.01);
    assert.equal(meanSquareToDbfs(0), MIN_DBFS);
    assert.equal(meanSquareToDbfs(-1), MIN_DBFS);
    assert.equal(meanSquareToDbfs(NaN), MIN_DBFS);
    assert.equal(meanSquareToDbfs(1e-30), MIN_DBFS);
});

test('dbfsToSpl', () => {
    assert.equal(dbfsToSpl(-65, 105), 40);
    assert.equal(dbfsToSpl(-200, 105), 0);
    assert.equal(dbfsToSpl(-10), 95);
});

test('smooth', () => {
    assert.equal(smooth(null, 5, 10), 5);
    assert.equal(smooth(1, 5, 0), 1);
    // After one time constant, 63.2% of the way there.
    near(smooth(0, 1, 125, 125), 0.632, 0.001);
    // Two steps of 62.5 ms equal one step of 125 ms.
    const twoSteps = smooth(smooth(0, 1, 62.5, 125), 1, 62.5, 125);
    near(twoSteps, smooth(0, 1, 125, 125), 1e-9);
    near(smooth(0, 1, 10000, 125), 1, 1e-9);
});

test('aWeightingDb matches the IEC 61672 table', () => {
    near(aWeightingDb(1000), 0, 0.01);
    // Table frequencies are nominal; 31.5 Hz is really 10^1.5 Hz and 16 kHz
    // is 10^4.2 Hz.
    near(aWeightingDb(31.623), -39.4, 0.1);
    near(aWeightingDb(63), -26.2, 0.1);
    near(aWeightingDb(100), -19.1, 0.1);
    near(aWeightingDb(250), -8.6, 0.1);
    near(aWeightingDb(500), -3.2, 0.1);
    near(aWeightingDb(2000), 1.2, 0.1);
    near(aWeightingDb(4000), 1.0, 0.1);
    near(aWeightingDb(8000), -1.1, 0.1);
    near(aWeightingDb(15849), -6.6, 0.1);
    assert.equal(aWeightingDb(0), -Infinity);
});

test('aWeightingPowerGains', () => {
    const gains = aWeightingPowerGains(1024, 48000, 2048);
    assert.equal(gains.length, 1024);
    assert.equal(gains[0], 0);
    // Bin 1000 Hz isn't exact; bin 43 is 1007.8 Hz.
    near(10 * Math.log10(gains[43]), aWeightingDb(1007.8125), 1e-4);
});

test('weightingCorrectionDb', () => {
    const gains = aWeightingPowerGains(1024, 48000, 2048);
    const spectrum = new Float32Array(1024).fill(-Infinity);

    // A single tone at 100 Hz (bin ~4.27, use bin 4 = 93.75 Hz).
    spectrum[4] = -20;
    near(weightingCorrectionDb(spectrum, gains), aWeightingDb(93.75), 1e-3);

    // Equal energy at 1 kHz-ish and 100 Hz-ish: mostly the 1 kHz part counts.
    spectrum[43] = -20;
    const expected =
        10 *
        Math.log10(
            (Math.pow(10, aWeightingDb(93.75) / 10) +
                Math.pow(10, aWeightingDb(1007.8125) / 10)) /
                2
        );
    near(weightingCorrectionDb(spectrum, gains), expected, 1e-3);

    // Nothing at all.
    assert.equal(
        weightingCorrectionDb(new Float32Array(1024).fill(-Infinity), gains),
        0
    );
});

test('LevelStats', () => {
    const stats = new LevelStats();
    assert.equal(stats.average(), null);
    stats.add(40);
    stats.add(60);
    stats.add(NaN);
    assert.equal(stats.count, 2);
    assert.equal(stats.min, 40);
    assert.equal(stats.max, 60);
    // Energy average: loud sounds dominate.
    near(stats.average() as number, 57.03, 0.01);
    stats.reset();
    assert.equal(stats.count, 0);
    assert.equal(stats.average(), null);
    stats.add(50);
    stats.add(50);
    near(stats.average() as number, 50, 1e-9);
});

test('SOUND_CATEGORIES are contiguous', () => {
    assert.equal(SOUND_CATEGORIES[0].min, 0);
    assert.equal(SOUND_CATEGORIES[SOUND_CATEGORIES.length - 1].max, null);

    for (let i = 1; i < SOUND_CATEGORIES.length; i += 1) {
        assert.equal(SOUND_CATEGORIES[i].min, SOUND_CATEGORIES[i - 1].max as number);
        assert.ok(SOUND_CATEGORIES[i].min > SOUND_CATEGORIES[i - 1].min);
    }
});

test('findCategoryIndex', () => {
    const id = (db: number) => SOUND_CATEGORIES[findCategoryIndex(db)]?.id;
    assert.equal(id(-5), 'threshold');
    assert.equal(id(0), 'threshold');
    assert.equal(id(9.9), 'threshold');
    assert.equal(id(10), 'whisper');
    assert.equal(id(40), 'quiet');
    assert.equal(id(45), 'conversation');
    assert.equal(id(65), 'office');
    assert.equal(id(84.9), 'traffic');
    assert.equal(id(85), 'mower');
    assert.equal(id(105), 'motorcycle');
    assert.equal(id(110), 'concert');
    assert.equal(id(120), 'pain');
    assert.equal(id(200), 'pain');
    assert.equal(id(Infinity), 'pain');
    assert.equal(id(-Infinity), 'threshold');
    assert.equal(findCategoryIndex(NaN), -1);
});

test('formatRange and formatDb', () => {
    assert.equal(formatRange({ id: 'x', min: 10, max: 30 }), '10–30 dB');
    assert.equal(formatRange({ id: 'x', min: 120, max: null }), '120+ dB');
    assert.equal(formatDb(42.4), '42');
    assert.equal(formatDb(42.5), '43');
    assert.equal(formatDb(null), '–');
    assert.equal(formatDb(Infinity), '–');
});
