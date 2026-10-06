// Turns magnetometer readings into "how much did the field change". Pure
// functions so the logic can be tested without a sensor.

import { AccessState } from '../services/access/access-controller';

export interface Detector {
    // Field strength in µT that counts as "nothing here".
    baseline: number | null;
    // Readings collected while waiting for a baseline.
    pending: number[];
    // Smoothed field strength in µT.
    smoothed: number | null;
}

// Readings averaged to get the starting baseline.
export const BASELINE_SAMPLES = 10;

// Smoothing factor per reading. At 30 readings per second this settles in
// about a fifth of a second, fast enough to feel live and slow enough to
// hide sensor noise.
export const SMOOTHING = 0.3;

// Changes smaller than this are sensor noise or tilting the phone.
export const QUIET_DELTA = 3;

// The gauge is full at this many µT of change. Phone magnetometers saturate
// somewhere above 1000 µT, but a fridge magnet up close is already a few
// hundred.
export const FULL_SCALE_DELTA = 300;

export function fieldStrength(x: number, y: number, z: number) {
    return Math.sqrt(x * x + y * y + z * z);
}

export function newDetector(): Detector {
    return { baseline: null, pending: [], smoothed: null };
}

function median(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function addReading(detector: Detector, strength: number): Detector {
    if (!isFinite(strength)) {
        return detector;
    }

    const smoothed =
        detector.smoothed === null
            ? strength
            : detector.smoothed + (strength - detector.smoothed) * SMOOTHING;

    if (detector.baseline !== null) {
        return { baseline: detector.baseline, pending: [], smoothed };
    }

    // The median ignores a stray reading while the sensor starts up.
    const pending = [...detector.pending, strength];

    if (pending.length >= BASELINE_SAMPLES) {
        return { baseline: median(pending), pending: [], smoothed };
    }

    return { baseline: null, pending, smoothed };
}

// Make the current reading the new "nothing here".
export function zero(detector: Detector): Detector {
    return {
        baseline: detector.smoothed,
        pending: [],
        smoothed: detector.smoothed,
    };
}

// Signed change from the baseline in µT, or null while still starting.
export function delta(detector: Detector) {
    if (detector.baseline === null || detector.smoothed === null) {
        return null;
    }

    return detector.smoothed - detector.baseline;
}

// 0 to 1 for the gauge. Logarithmic, so a few µT is visible and a magnet
// doesn't need a gauge a mile long.
export function gaugeFraction(change: number | null) {
    if (change === null || !isFinite(change)) {
        return 0;
    }

    const size = Math.abs(change);

    return Math.min(1, Math.log1p(size) / Math.log1p(FULL_SCALE_DELTA));
}

export interface Tone {
    // Hz
    frequency: number;
    // Milliseconds between beeps.
    interval: number;
}

// Like a real metal detector: silent when nothing is there, then beeps that
// get higher and faster the stronger the change.
export function toneFor(change: number | null): Tone | null {
    if (change === null || !(Math.abs(change) >= QUIET_DELTA)) {
        return null;
    }

    const strength = gaugeFraction(change);

    return {
        frequency: Math.round(300 + 1200 * strength),
        interval: Math.round(600 - 520 * strength),
    };
}

export const enum Strength {
    NONE = 'NONE',
    WEAK = 'WEAK',
    MEDIUM = 'MEDIUM',
    STRONG = 'STRONG',
}

export function strengthFor(change: number | null) {
    const size = change === null ? 0 : Math.abs(change);

    if (size < QUIET_DELTA) {
        return Strength.NONE;
    }

    if (size < 20) {
        return Strength.WEAK;
    }

    if (size < 100) {
        return Strength.MEDIUM;
    }

    return Strength.STRONG;
}

export function formatMicrotesla(value: number | null, signed = false) {
    if (value === null || !isFinite(value)) {
        return '—';
    }

    const text = Math.abs(value).toFixed(1);

    if (!signed) {
        return `${text} µT`;
    }

    // Avoid "-0.0".
    if (text === '0.0') {
        return '0.0 µT';
    }

    return `${value < 0 ? '−' : '+'}${text} µT`;
}

// Generic Sensor API errors, either thrown by the constructor or delivered
// in an "error" event.
export function classifySensorError(error: any): AccessState {
    switch (error && error.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return AccessState.DENIED;

        case 'NotReadableError':
        case 'NotSupportedError':
        case 'ReferenceError':
            return AccessState.UNAVAILABLE;

        default:
            return AccessState.ERROR;
    }
}
