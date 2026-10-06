// Sound level math. No DOM here so it can be tested.

// Converts digital full scale (dBFS) to an estimate of sound pressure level
// (dB SPL). Phones don't expose their microphone sensitivity and every model
// is different, so this is a fixed guess. Typical MEMS microphones are
// specified around -38 dBFS at 94 dB SPL, which would mean +132, but the
// operating system usually adds gain before the browser sees the audio. An
// offset of 105 makes a quiet room read roughly 35 to 45 dB on the phones we
// tried. Readings are approximate and uncalibrated.
export const SPL_OFFSET_DB = 105;

// Quietest level reported. Digital silence would otherwise be -Infinity.
export const MIN_DBFS = -120;

// "Fast" time weighting from sound level meters.
export const FAST_TIME_CONSTANT_MS = 125;

// Mean of the squared samples. Squared values are what get averaged and
// smoothed, because sound energy adds up while decibels don't.
export function meanSquare(samples: ArrayLike<number>) {
    if (!samples.length) {
        return 0;
    }

    let sum = 0;

    for (let i = 0; i < samples.length; i += 1) {
        sum += samples[i] * samples[i];
    }

    return sum / samples.length;
}

// A full-scale sine wave has a mean square of 0.5. That's defined as 0 dBFS
// by most meters, so add 3 dB to make that line up.
export function meanSquareToDbfs(value: number) {
    if (!(value > 0)) {
        return MIN_DBFS;
    }

    return Math.max(MIN_DBFS, 10 * Math.log10(value * 2));
}

export function dbfsToSpl(dbfs: number, offset = SPL_OFFSET_DB) {
    return Math.max(0, dbfs + offset);
}

// Exponential smoothing that behaves the same no matter how often it's
// called, so a slow frame rate doesn't change the meter's response.
export function smooth(
    previous: number | null,
    value: number,
    elapsedMs: number,
    timeConstantMs = FAST_TIME_CONSTANT_MS
) {
    if (previous === null || !isFinite(previous)) {
        return value;
    }

    const alpha = 1 - Math.exp(-Math.max(0, elapsedMs) / timeConstantMs);

    return previous + (value - previous) * alpha;
}

// A-weighting from IEC 61672-1, in dB. Human hearing is far less sensitive
// to low (and very high) frequencies, and regular sound meters report dBA.
export function aWeightingDb(frequency: number) {
    if (!(frequency > 0)) {
        return -Infinity;
    }

    const f2 = frequency * frequency;
    const ra =
        (12194 ** 2 * f2 * f2) /
        ((f2 + 20.6 ** 2) *
            Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) *
            (f2 + 12194 ** 2));

    return 20 * Math.log10(ra) + 2;
}

// Power multipliers (not dB) for each FFT bin of an AnalyserNode.
export function aWeightingPowerGains(
    binCount: number,
    sampleRate: number,
    fftSize: number
) {
    const gains = new Float32Array(binCount);

    for (let i = 0; i < binCount; i += 1) {
        const db = aWeightingDb((i * sampleRate) / fftSize);
        gains[i] = isFinite(db) ? Math.pow(10, db / 10) : 0;
    }

    return gains;
}

// How much quieter (in dB, usually negative) the sound is after A-weighting.
// This is a ratio of the weighted and unweighted spectrum, so the window and
// scaling the analyser uses cancel out. Add it to the unweighted level.
export function weightingCorrectionDb(
    spectrumDb: ArrayLike<number>,
    gains: ArrayLike<number>
) {
    let total = 0;
    let weighted = 0;
    const count = Math.min(spectrumDb.length, gains.length);

    for (let i = 1; i < count; i += 1) {
        const db = spectrumDb[i];

        if (!isFinite(db)) {
            continue;
        }

        const power = Math.pow(10, db / 10);
        total += power;
        weighted += power * gains[i];
    }

    if (!(total > 0) || !(weighted > 0)) {
        return 0;
    }

    return 10 * Math.log10(weighted / total);
}

// Tracks min, max and average since the last reset. The average is an
// energy average (Leq), like a sound meter, not an average of decibels.
export class LevelStats {
    count = 0;
    max = -Infinity;
    min = Infinity;
    private _energy = 0;

    add(db: number) {
        if (!isFinite(db)) {
            return;
        }

        this.count += 1;
        this.min = Math.min(this.min, db);
        this.max = Math.max(this.max, db);
        this._energy += Math.pow(10, db / 10);
    }

    average() {
        if (!this.count) {
            return null;
        }

        return 10 * Math.log10(this._energy / this.count);
    }

    reset() {
        this.count = 0;
        this.max = -Infinity;
        this.min = Infinity;
        this._energy = 0;
    }
}

export interface SoundCategory {
    id: string;
    // Inclusive.
    min: number;
    // Exclusive. Null for the top category.
    max: number | null;
}

// Each range starts where the previous one ends.
export const SOUND_CATEGORIES: SoundCategory[] = [
    { id: 'threshold', min: 0, max: 10 },
    { id: 'whisper', min: 10, max: 30 },
    { id: 'quiet', min: 30, max: 45 },
    { id: 'conversation', min: 45, max: 60 },
    { id: 'office', min: 60, max: 70 },
    { id: 'traffic', min: 70, max: 85 },
    { id: 'mower', min: 85, max: 100 },
    { id: 'motorcycle', min: 100, max: 110 },
    { id: 'concert', min: 110, max: 120 },
    { id: 'pain', min: 120, max: null },
];

export function findCategoryIndex(
    db: number,
    categories: SoundCategory[] = SOUND_CATEGORIES
) {
    if (isNaN(db)) {
        return -1;
    }

    // Anything below the first range counts as the first range.
    for (let i = categories.length - 1; i >= 0; i -= 1) {
        if (db >= categories[i].min) {
            return i;
        }
    }

    return 0;
}

export function formatRange(category: SoundCategory) {
    if (category.max === null) {
        return `${category.min}+ dB`;
    }

    return `${category.min}–${category.max} dB`;
}

export function formatDb(db: number | null) {
    if (db === null || !isFinite(db)) {
        return '–';
    }

    return `${Math.round(db)}`;
}
