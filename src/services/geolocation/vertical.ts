// Ascent, descent, vertical speed, and glide ratio from a stream of GPS
// fixes. Pure functions over an immutable state so the running values can
// ride along on each position like the other cumulative attributes.
//
// GPS altitude is noisy: consecutive fixes often wander by 5 to 15 meters
// while standing still. Adding up every rise between fixes would report
// hundreds of meters of "climbing" on flat ground, so the altitude is first
// smoothed and then passed through a dead band (hysteresis): a climb or drop
// only counts once the smoothed altitude moves at least `threshold` meters
// away from the last committed altitude (the anchor). When it does, the whole
// move from the anchor is counted and the anchor moves there.
//
// Definitions used by the fields:
//
// * Total: sum of committed moves in that direction. It trails the truth by
//   less than one threshold, and each turnaround (summit or valley) can hide
//   up to one threshold of the extreme.
// * Time ascending / descending: for each committed move, the time since the
//   smoothed altitude last sat at or beyond the anchor on the other side. Time
//   spent resting on a plateau is mostly excluded because noise keeps
//   crossing the anchor there, which restarts the clock.
// * Average: total / time spent moving in that direction.
// * Minimum and maximum: committed moves are grouped into samples of at least
//   RATE_SAMPLE_MS so one noisy step can't create a wild rate, and the lowest
//   and highest sample rates are kept. A shorter sample at a turnaround still
//   counts if it lasted at least MIN_RATE_SAMPLE_MS.
// * Vertical speed: the rate of change of the smoothed altitude, smoothed
//   again. Signed, positive is up.
// * Glide ratio: horizontal distance covered divided by altitude lost over the
//   last GLIDE_WINDOW_MS. Only defined while losing altitude.
//
// All speeds are meters per second, all times are milliseconds.

// Smoothing time constant for the altitude and the vertical speed.
export const SMOOTHING_MS = 10000;

// A gap this long (lost signal) restarts the smoothing instead of blending
// stale altitude with new.
export const GAP_MS = 120000;

// Dead band limits. The altitude accuracy is used when the browser reports
// it, clamped so a pessimistic report (30 m is common) doesn't swallow real
// hills and an optimistic one doesn't let noise through.
export const THRESHOLD_MINIMUM = 3;
export const THRESHOLD_MAXIMUM = 10;
export const THRESHOLD_DEFAULT = 5;

export const RATE_SAMPLE_MS = 30000;
export const MIN_RATE_SAMPLE_MS = 10000;

export const GLIDE_WINDOW_MS = 60000;
export const GLIDE_MIN_WINDOW_MS = 10000;
export const GLIDE_MIN_DROP = 3;

export interface VerticalFix {
    timestamp: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    // Cumulative horizontal distance, used for the glide ratio.
    distanceTraveled: number;
}

interface DirectionState {
    total: number;
    time: number;
    rateMinimum: number;
    rateMaximum: number;
}

interface RateSample {
    direction: 1 | -1 | 0;
    amount: number;
    duration: number;
}

interface GlideSample {
    timestamp: number;
    altitude: number;
    distance: number;
}

export interface VerticalState {
    lastTimestamp: number;
    smoothedAltitude: number;
    verticalSpeed: number;
    anchorAltitude: number;
    // Last time the smoothed altitude was at or below / at or above the
    // anchor. A climb is timed from upStart, a descent from downStart.
    upStart: number;
    downStart: number;
    ascent: DirectionState;
    descent: DirectionState;
    sample: RateSample;
    glide: GlideSample[];
}

export interface DirectionSummary {
    total: number;
    average: number;
    minimum: number;
    maximum: number;
}

function emptyDirection(): DirectionState {
    return { total: 0, time: 0, rateMinimum: NaN, rateMaximum: NaN };
}

export function initialVerticalState(): VerticalState {
    return {
        lastTimestamp: NaN,
        smoothedAltitude: NaN,
        verticalSpeed: NaN,
        anchorAltitude: NaN,
        upStart: NaN,
        downStart: NaN,
        ascent: emptyDirection(),
        descent: emptyDirection(),
        sample: { direction: 0, amount: 0, duration: 0 },
        glide: [],
    };
}

export function altitudeThreshold(altitudeAccuracy: number | null): number {
    const accuracy =
        typeof altitudeAccuracy === 'number' && altitudeAccuracy > 0
            ? altitudeAccuracy
            : THRESHOLD_DEFAULT;

    return Math.min(THRESHOLD_MAXIMUM, Math.max(THRESHOLD_MINIMUM, accuracy));
}

function withRate(direction: DirectionState, rate: number): DirectionState {
    return {
        ...direction,
        rateMinimum: isNaN(direction.rateMinimum)
            ? rate
            : Math.min(direction.rateMinimum, rate),
        rateMaximum: isNaN(direction.rateMaximum)
            ? rate
            : Math.max(direction.rateMaximum, rate),
    };
}

function sampleRate(sample: RateSample) {
    return sample.amount / (sample.duration / 1000);
}

// Records a finished rate sample on the matching direction.
function recordSample(
    state: VerticalState,
    sample: RateSample,
    minimumDuration: number
) {
    if (sample.direction === 0 || sample.duration < minimumDuration) {
        return;
    }

    const rate = sampleRate(sample);

    if (sample.direction > 0) {
        state.ascent = withRate(state.ascent, rate);
    } else {
        state.descent = withRate(state.descent, rate);
    }
}

function commit(
    state: VerticalState,
    direction: 1 | -1,
    amount: number,
    duration: number
) {
    const key = direction > 0 ? 'ascent' : 'descent';
    state[key] = {
        ...state[key],
        total: state[key].total + amount,
        time: state[key].time + duration,
    };

    let sample = state.sample;

    if (sample.direction !== direction) {
        recordSample(state, sample, MIN_RATE_SAMPLE_MS);
        sample = { direction, amount: 0, duration: 0 };
    }

    sample = {
        direction,
        amount: sample.amount + amount,
        duration: sample.duration + duration,
    };

    if (sample.duration >= RATE_SAMPLE_MS) {
        recordSample(state, sample, RATE_SAMPLE_MS);
        sample = { direction, amount: 0, duration: 0 };
    }

    state.sample = sample;
}

export function updateVertical(
    previous: VerticalState,
    fix: VerticalFix
): VerticalState {
    // Fixes without altitude (and repeated fixes) change nothing.
    if (typeof fix.altitude !== 'number' || isNaN(fix.altitude)) {
        return previous;
    }

    const t = fix.timestamp;
    const dt = t - previous.lastTimestamp;

    if (dt <= 0) {
        return previous;
    }

    const state: VerticalState = { ...previous, lastTimestamp: t };

    if (isNaN(previous.smoothedAltitude) || dt > GAP_MS) {
        state.smoothedAltitude = fix.altitude;
        state.verticalSpeed = NaN;
        state.glide = [];

        if (isNaN(previous.anchorAltitude)) {
            state.anchorAltitude = fix.altitude;
            state.upStart = t;
            state.downStart = t;
        }
    } else {
        // Time-aware exponential moving average, so irregular fix intervals
        // get the right amount of weight.
        const alpha = 1 - Math.exp(-dt / SMOOTHING_MS);
        state.smoothedAltitude =
            previous.smoothedAltitude +
            alpha * (fix.altitude - previous.smoothedAltitude);
        const rawSpeed =
            (state.smoothedAltitude - previous.smoothedAltitude) / (dt / 1000);
        state.verticalSpeed = isNaN(previous.verticalSpeed)
            ? rawSpeed
            : previous.verticalSpeed +
              alpha * (rawSpeed - previous.verticalSpeed);
    }

    const altitude = state.smoothedAltitude;
    const threshold = altitudeThreshold(fix.altitudeAccuracy);
    const anchor = state.anchorAltitude;

    if (altitude >= anchor + threshold) {
        commit(state, 1, altitude - anchor, t - state.upStart);
        state.anchorAltitude = altitude;
        state.upStart = t;
        state.downStart = t;
    } else if (altitude <= anchor - threshold) {
        commit(state, -1, anchor - altitude, t - state.downStart);
        state.anchorAltitude = altitude;
        state.upStart = t;
        state.downStart = t;
    } else {
        if (altitude <= anchor) {
            state.upStart = t;
        }

        if (altitude >= anchor) {
            state.downStart = t;
        }
    }

    state.glide = [
        ...state.glide.filter(
            (sample) => t - sample.timestamp <= GLIDE_WINDOW_MS
        ),
        { timestamp: t, altitude, distance: fix.distanceTraveled },
    ];

    return state;
}

function summarize(
    direction: DirectionState,
    sample: RateSample,
    sign: 1 | -1
): DirectionSummary {
    let minimum = direction.rateMinimum;
    let maximum = direction.rateMaximum;

    // Include the sample in progress so the fields don't sit empty for the
    // first half minute of a climb.
    if (sample.direction === sign && sample.duration >= MIN_RATE_SAMPLE_MS) {
        const rate = sampleRate(sample);
        minimum = isNaN(minimum) ? rate : Math.min(minimum, rate);
        maximum = isNaN(maximum) ? rate : Math.max(maximum, rate);
    }

    return {
        total: direction.total,
        average: direction.time ? direction.total / (direction.time / 1000) : NaN,
        minimum,
        maximum,
    };
}

export function ascentSummary(state: VerticalState): DirectionSummary {
    return summarize(state.ascent, state.sample, 1);
}

export function descentSummary(state: VerticalState): DirectionSummary {
    return summarize(state.descent, state.sample, -1);
}

// Horizontal distance per unit of altitude lost, or NaN when not descending
// (a ratio while climbing or level is meaningless or infinite).
export function glideRatio(state: VerticalState): number {
    const samples = state.glide;

    if (samples.length < 2) {
        return NaN;
    }

    const first = samples[0];
    const last = samples[samples.length - 1];

    if (last.timestamp - first.timestamp < GLIDE_MIN_WINDOW_MS) {
        return NaN;
    }

    const drop = first.altitude - last.altitude;

    if (drop < GLIDE_MIN_DROP) {
        return NaN;
    }

    return (last.distance - first.distance) / drop;
}
