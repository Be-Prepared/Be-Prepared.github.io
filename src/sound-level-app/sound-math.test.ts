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
import test from 'ava';

function near(t: any, actual: number, expected: number, tolerance = 0.1) {
    t.true(
        Math.abs(actual - expected) <= tolerance,
        `${actual} is not within ${tolerance} of ${expected}`
    );
}

test('meanSquare', (t) => {
    t.is(meanSquare([]), 0);
    t.is(meanSquare([1, -1, 1, -1]), 1);
    t.is(meanSquare([0.5, -0.5]), 0.25);
});

test('meanSquareToDbfs: full scale sine is 0 dBFS', (t) => {
    const samples = new Float32Array(48000);

    for (let i = 0; i < samples.length; i += 1) {
        samples[i] = Math.sin((2 * Math.PI * 1000 * i) / 48000);
    }

    near(t, meanSquareToDbfs(meanSquare(samples)), 0, 0.01);
});

test('meanSquareToDbfs: half amplitude is -6 dB, silence is clamped', (t) => {
    near(t, meanSquareToDbfs(0.125), -6.02, 0.01);
    t.is(meanSquareToDbfs(0), MIN_DBFS);
    t.is(meanSquareToDbfs(-1), MIN_DBFS);
    t.is(meanSquareToDbfs(NaN), MIN_DBFS);
    t.is(meanSquareToDbfs(1e-30), MIN_DBFS);
});

test('dbfsToSpl', (t) => {
    t.is(dbfsToSpl(-65, 105), 40);
    t.is(dbfsToSpl(-200, 105), 0);
    t.is(dbfsToSpl(-10), 95);
});

test('smooth', (t) => {
    t.is(smooth(null, 5, 10), 5);
    t.is(smooth(1, 5, 0), 1);
    // After one time constant, 63.2% of the way there.
    near(t, smooth(0, 1, 125, 125), 0.632, 0.001);
    // Two steps of 62.5 ms equal one step of 125 ms.
    const twoSteps = smooth(smooth(0, 1, 62.5, 125), 1, 62.5, 125);
    near(t, twoSteps, smooth(0, 1, 125, 125), 1e-9);
    near(t, smooth(0, 1, 10000, 125), 1, 1e-9);
});

test('aWeightingDb matches the IEC 61672 table', (t) => {
    near(t, aWeightingDb(1000), 0, 0.01);
    // Table frequencies are nominal; 31.5 Hz is really 10^1.5 Hz and 16 kHz
    // is 10^4.2 Hz.
    near(t, aWeightingDb(31.623), -39.4, 0.1);
    near(t, aWeightingDb(63), -26.2, 0.1);
    near(t, aWeightingDb(100), -19.1, 0.1);
    near(t, aWeightingDb(250), -8.6, 0.1);
    near(t, aWeightingDb(500), -3.2, 0.1);
    near(t, aWeightingDb(2000), 1.2, 0.1);
    near(t, aWeightingDb(4000), 1.0, 0.1);
    near(t, aWeightingDb(8000), -1.1, 0.1);
    near(t, aWeightingDb(15849), -6.6, 0.1);
    t.is(aWeightingDb(0), -Infinity);
});

test('aWeightingPowerGains', (t) => {
    const gains = aWeightingPowerGains(1024, 48000, 2048);
    t.is(gains.length, 1024);
    t.is(gains[0], 0);
    // Bin 1000 Hz isn't exact; bin 43 is 1007.8 Hz.
    near(t, 10 * Math.log10(gains[43]), aWeightingDb(1007.8125), 1e-4);
});

test('weightingCorrectionDb', (t) => {
    const gains = aWeightingPowerGains(1024, 48000, 2048);
    const spectrum = new Float32Array(1024).fill(-Infinity);

    // A single tone at 100 Hz (bin ~4.27, use bin 4 = 93.75 Hz).
    spectrum[4] = -20;
    near(t, weightingCorrectionDb(spectrum, gains), aWeightingDb(93.75), 1e-3);

    // Equal energy at 1 kHz-ish and 100 Hz-ish: mostly the 1 kHz part counts.
    spectrum[43] = -20;
    const expected =
        10 *
        Math.log10(
            (Math.pow(10, aWeightingDb(93.75) / 10) +
                Math.pow(10, aWeightingDb(1007.8125) / 10)) /
                2
        );
    near(t, weightingCorrectionDb(spectrum, gains), expected, 1e-3);

    // Nothing at all.
    t.is(
        weightingCorrectionDb(new Float32Array(1024).fill(-Infinity), gains),
        0
    );
});

test('LevelStats', (t) => {
    const stats = new LevelStats();
    t.is(stats.average(), null);
    stats.add(40);
    stats.add(60);
    stats.add(NaN);
    t.is(stats.count, 2);
    t.is(stats.min, 40);
    t.is(stats.max, 60);
    // Energy average: loud sounds dominate.
    near(t, stats.average() as number, 57.03, 0.01);
    stats.reset();
    t.is(stats.count, 0);
    t.is(stats.average(), null);
    stats.add(50);
    stats.add(50);
    near(t, stats.average() as number, 50, 1e-9);
});

test('SOUND_CATEGORIES are contiguous', (t) => {
    t.is(SOUND_CATEGORIES[0].min, 0);
    t.is(SOUND_CATEGORIES[SOUND_CATEGORIES.length - 1].max, null);

    for (let i = 1; i < SOUND_CATEGORIES.length; i += 1) {
        t.is(SOUND_CATEGORIES[i].min, SOUND_CATEGORIES[i - 1].max as number);
        t.true(SOUND_CATEGORIES[i].min > SOUND_CATEGORIES[i - 1].min);
    }
});

test('findCategoryIndex', (t) => {
    const id = (db: number) => SOUND_CATEGORIES[findCategoryIndex(db)]?.id;
    t.is(id(-5), 'threshold');
    t.is(id(0), 'threshold');
    t.is(id(9.9), 'threshold');
    t.is(id(10), 'whisper');
    t.is(id(40), 'quiet');
    t.is(id(45), 'conversation');
    t.is(id(65), 'office');
    t.is(id(84.9), 'traffic');
    t.is(id(85), 'mower');
    t.is(id(105), 'motorcycle');
    t.is(id(110), 'concert');
    t.is(id(120), 'pain');
    t.is(id(200), 'pain');
    t.is(id(Infinity), 'pain');
    t.is(id(-Infinity), 'threshold');
    t.is(findCategoryIndex(NaN), -1);
});

test('formatRange and formatDb', (t) => {
    t.is(formatRange({ id: 'x', min: 10, max: 30 }), '10–30 dB');
    t.is(formatRange({ id: 'x', min: 120, max: null }), '120+ dB');
    t.is(formatDb(42.4), '42');
    t.is(formatDb(42.5), '43');
    t.is(formatDb(null), '–');
    t.is(formatDb(Infinity), '–');
});
