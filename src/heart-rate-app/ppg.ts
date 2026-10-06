// Signal processing for camera photoplethysmography (PPG). With a fingertip
// over the camera and the light on, each heartbeat pushes a little more blood
// into the fingertip, which absorbs a little more light. The average
// brightness of the picture rises and falls with the pulse by well under 1%,
// on top of much larger slow drift from pressure changes and auto exposure.
//
// Nothing here touches the DOM so it can be tested with synthetic signals.

export interface Sample {
    // Milliseconds. Only differences matter.
    t: number;
    v: number;
}

export interface FrameStats {
    blue: number;
    green: number;
    red: number;
    // Standard deviation of the red channel across the frame.
    redSpread: number;
}

export interface BpmEstimate {
    bpm: number;
    // 0 (noise) to 1 (perfectly periodic).
    quality: number;
}

// 42 to 210 beats per minute.
export const MIN_HZ = 0.7;
export const MAX_HZ = 3.5;
export const SAMPLE_RATE = 30;

// The low pass sits a little above the fastest pulse, because a Butterworth
// filter already weakens the signal near its corner.
const FILTER_HIGH_HZ = 4;

// Estimates below this are not shown.
export const GOOD_QUALITY = 0.5;

// Mean color and red spread of an RGBA pixel buffer, such as ImageData.data.
export function frameStats(data: ArrayLike<number>): FrameStats {
    const pixels = Math.floor(data.length / 4);

    if (!pixels) {
        return { red: 0, green: 0, blue: 0, redSpread: 0 };
    }

    let red = 0;
    let green = 0;
    let blue = 0;
    let redSquares = 0;

    for (let i = 0; i < pixels * 4; i += 4) {
        red += data[i];
        green += data[i + 1];
        blue += data[i + 2];
        redSquares += data[i] * data[i];
    }

    red /= pixels;
    green /= pixels;
    blue /= pixels;

    return {
        red,
        green,
        blue,
        redSpread: Math.sqrt(Math.max(0, redSquares / pixels - red * red)),
    };
}

// A lit fingertip fills the picture with an even, bright red. Anything else
// (a room, a partly covered lens, darkness) fails at least one of these.
export function isFingerPresent(stats: FrameStats) {
    return (
        stats.red >= 60 &&
        stats.red >= stats.green * 1.6 &&
        stats.red >= stats.blue * 1.6 &&
        stats.redSpread <= Math.max(12, stats.red * 0.15)
    );
}

// Camera frames don't arrive evenly. Linear interpolation onto an even grid
// ending at the newest sample.
export function resample(samples: Sample[], rate = SAMPLE_RATE): number[] {
    if (samples.length < 2) {
        return [];
    }

    const step = 1000 / rate;
    const start = samples[0].t;
    const end = samples[samples.length - 1].t;
    const count = Math.floor((end - start) / step) + 1;
    const result: number[] = new Array(count);
    let j = 0;

    for (let i = 0; i < count; i += 1) {
        const t = end - (count - 1 - i) * step;

        while (j < samples.length - 2 && samples[j + 1].t < t) {
            j += 1;
        }

        const a = samples[j];
        const b = samples[j + 1];
        const span = b.t - a.t;
        const f = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
        result[i] = a.v + (b.v - a.v) * f;
    }

    return result;
}

interface Biquad {
    a1: number;
    a2: number;
    b0: number;
    b1: number;
    b2: number;
}

// Second order Butterworth sections (RBJ audio EQ cookbook, Q = 1/sqrt 2).
function biquad(type: 'high' | 'low', hz: number, rate: number): Biquad {
    const w = (2 * Math.PI * hz) / rate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
    const a0 = 1 + alpha;
    const b1 = type === 'low' ? 1 - cos : -(1 + cos);
    const b0 = type === 'low' ? b1 / 2 : -b1 / 2;

    return {
        b0: b0 / a0,
        b1: b1 / a0,
        b2: b0 / a0,
        a1: (-2 * cos) / a0,
        a2: (1 - alpha) / a0,
    };
}

function runBiquad(values: number[], f: Biquad) {
    const out: number[] = new Array(values.length);
    let x1 = values[0] || 0;
    let x2 = x1;
    // Start the high pass at rest on the first value instead of ringing
    // from a step at zero.
    let y1 = Math.abs(f.b0 + f.b1 + f.b2) < 1e-9 ? 0 : x1;
    let y2 = y1;

    for (let i = 0; i < values.length; i += 1) {
        const x = values[i];
        const y = f.b0 * x + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
        out[i] = y;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
    }

    return out;
}

// Zero phase (forward then backward) band pass. Removes drift and the
// flicker and noise that are too fast to be a pulse.
export function bandPass(
    values: number[],
    rate = SAMPLE_RATE,
    lowHz = MIN_HZ,
    highHz = FILTER_HIGH_HZ
) {
    if (values.length < 3) {
        return values.map(() => 0);
    }

    // Subtract the mean first so the high pass does not start with a jump.
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let result = values.map((v) => v - mean);
    const sections = [biquad('high', lowHz, rate), biquad('low', highHz, rate)];

    for (let pass = 0; pass < 2; pass += 1) {
        for (const section of sections) {
            result = runBiquad(result, section);
        }

        result.reverse();
    }

    return result;
}

// Normalized autocorrelation, 1 at lag 0.
export function autocorrelation(values: number[], maxLag: number) {
    const n = values.length;
    let energy = 0;

    for (const v of values) {
        energy += v * v;
    }

    const result: number[] = [];

    for (let lag = 0; lag <= Math.min(maxLag, n - 1); lag += 1) {
        let sum = 0;

        for (let i = 0; i + lag < n; i += 1) {
            sum += values[i] * values[i + lag];
        }

        // Unbiased so long lags are not penalized, then normalized.
        result.push(energy > 0 ? (sum / (n - lag)) * (n / energy) : 0);
    }

    return result;
}

// Indexes of beats: local maxima above zero at least minGap samples apart.
// When two candidates are too close, the taller one wins.
export function detectPeaks(values: number[], minGap: number) {
    const peaks: number[] = [];

    for (let i = 1; i < values.length - 1; i += 1) {
        const v = values[i];

        if (v <= 0 || v < values[i - 1] || v <= values[i + 1]) {
            continue;
        }

        const last = peaks[peaks.length - 1];

        if (last !== undefined && i - last < minGap) {
            if (v > values[last]) {
                peaks[peaks.length - 1] = i;
            }
        } else {
            peaks.push(i);
        }
    }

    return peaks;
}

function median(values: number[]) {
    if (!values.length) {
        return NaN;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Heart rate from a band passed signal. The autocorrelation finds the
// period; counting peaks confirms it. Quality is how strongly the signal
// repeats, reduced when the two methods disagree.
export function estimateFromFiltered(
    filtered: number[],
    rate = SAMPLE_RATE
): BpmEstimate {
    const none = { bpm: 0, quality: 0 };
    const minLag = Math.floor(rate / MAX_HZ);
    const maxLag = Math.ceil(rate / MIN_HZ);

    // Need at least a few beats at the slowest rate.
    if (filtered.length < maxLag * 3) {
        return none;
    }

    const ac = autocorrelation(filtered, maxLag + 1);

    // A real pulse makes the autocorrelation swing negative half a beat
    // after lag 0. Band limited noise just slowly decays, so peaks found
    // before that are not beats.
    let firstNegative = 1;

    while (firstNegative < ac.length && ac[firstNegative] > 0) {
        firstNegative += 1;
    }

    let best = -1;

    for (let lag = Math.max(minLag, firstNegative); lag < maxLag; lag += 1) {
        if (
            ac[lag] > ac[lag - 1] &&
            ac[lag] >= ac[lag + 1] &&
            (best < 0 || ac[lag] > ac[best])
        ) {
            best = lag;
        }
    }

    if (best < 0 || ac[best] <= 0) {
        return none;
    }

    // Prefer the shortest period that is nearly as strong, so a pulse at
    // 150 is not read as 75.
    for (let lag = Math.max(minLag, firstNegative); lag < best; lag += 1) {
        if (
            ac[lag] > ac[lag - 1] &&
            ac[lag] >= ac[lag + 1] &&
            ac[lag] >= ac[best] * 0.7
        ) {
            best = lag;
            break;
        }
    }

    // Parabolic interpolation for sub-sample precision.
    const a = ac[best - 1];
    const b = ac[best];
    const c = ac[best + 1];
    const denominator = a - 2 * b + c;
    const offset =
        denominator < 0
            ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * denominator)))
            : 0;
    const period = best + offset;
    const bpm = (60 * rate) / period;

    const peaks = detectPeaks(filtered, Math.round(period * 0.6));
    const intervals: number[] = [];

    for (let i = 1; i < peaks.length; i += 1) {
        intervals.push(peaks[i] - peaks[i - 1]);
    }

    let agreement = 0;

    if (intervals.length >= 2) {
        const peakBpm = (60 * rate) / median(intervals);
        const difference = Math.abs(peakBpm - bpm) / bpm;
        agreement = Math.max(0, 1 - difference * 5);
    }

    return {
        bpm,
        quality: Math.max(0, Math.min(1, b)) * agreement,
    };
}

export function estimateBpm(
    samples: Sample[],
    windowSeconds = 10,
    rate = SAMPLE_RATE
): BpmEstimate {
    const recent = lastSeconds(samples, windowSeconds);

    return estimateFromFiltered(bandPass(resample(recent, rate), rate), rate);
}

// The newest part of the signal, filtered and scaled to -1..1 for drawing.
export function waveform(
    samples: Sample[],
    seconds = 5,
    rate = SAMPLE_RATE
): number[] {
    // Filter a longer stretch than is shown so the edges have settled.
    const filtered = bandPass(
        resample(lastSeconds(samples, seconds + 3), rate),
        rate
    );
    const shown = filtered.slice(-Math.round(seconds * rate));
    const peak = shown.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

    return peak > 0 ? shown.map((v) => v / peak) : shown;
}

// Final answer for a whole measurement: the median of the good estimates.
export function summarize(estimates: BpmEstimate[]) {
    const good = estimates.filter((e) => e.quality >= GOOD_QUALITY);

    // Too few good readings means the finger moved most of the time.
    if (good.length < 3) {
        return null;
    }

    return Math.round(median(good.map((e) => e.bpm)));
}

export function lastSeconds(samples: Sample[], seconds: number) {
    if (!samples.length) {
        return samples;
    }

    const cutoff = samples[samples.length - 1].t - seconds * 1000;
    let i = samples.length - 1;

    while (i > 0 && samples[i - 1].t >= cutoff) {
        i -= 1;
    }

    return samples.slice(i);
}
