// Distance tracking from GPS fixes. Pure functions so the jitter filter can be
// tested with synthetic positions.

export interface Fix {
    lat: number;
    lon: number;
    // Radius in meters, as reported by the browser.
    accuracy: number;
    // Milliseconds.
    timestamp: number;
}

export interface Track {
    // Last fix that counted. Movement is measured from here, not from the
    // previous fix, so many tiny wobbles can't add up to a distance.
    anchor: Fix | null;
    // Meters.
    distance: number;
}

export const enum FixResult {
    // First good fix after starting or resuming. Nothing to measure yet.
    ANCHORED = 'ANCHORED',
    // Too inaccurate to use.
    INACCURATE = 'INACCURATE',
    // Moved a believable amount; distance was added.
    MOVED = 'MOVED',
    // Within the noise of the GPS; treated as standing still.
    STILL = 'STILL',
    // An impossible jump, such as a bad fix from a cell tower.
    JUMP = 'JUMP',
}

// Fixes worse than this are ignored entirely.
export const MAX_ACCURACY = 30;

// Never count a movement smaller than this, even with a perfect fix.
export const MIN_STEP = 3;

// Faster than anyone walks, runs or cycles. Anything faster is a GPS glitch.
export const MAX_SPEED = 25;

export function newTrack(): Track {
    return { anchor: null, distance: 0 };
}

// Forget the anchor so distance covered while paused isn't counted.
export function pauseTrack(track: Track): Track {
    return { anchor: null, distance: track.distance };
}

// Great-circle distance in meters.
export function haversine(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number }
) {
    const toRad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toRad;
    const dLon = (b.lon - a.lon) * toRad;
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * toRad) *
            Math.cos(b.lat * toRad) *
            Math.sin(dLon / 2) ** 2;

    return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// How far a fix needs to be from the anchor before it counts as movement.
// Both positions can be off by their accuracy, so standing still produces
// "movement" of roughly that size.
export function movementThreshold(anchor: Fix, fix: Fix) {
    return Math.max(MIN_STEP, 0.5 * Math.max(anchor.accuracy, fix.accuracy));
}

export function addFix(
    track: Track,
    fix: Fix
): { track: Track; result: FixResult } {
    if (!(fix.accuracy <= MAX_ACCURACY) || !isFinite(fix.lat + fix.lon)) {
        return { track, result: FixResult.INACCURATE };
    }

    const anchor = track.anchor;

    if (!anchor) {
        return {
            track: { anchor: fix, distance: track.distance },
            result: FixResult.ANCHORED,
        };
    }

    const moved = haversine(anchor, fix);

    if (moved <= movementThreshold(anchor, fix)) {
        // Keep the old anchor. If the new fix is more accurate, use it
        // instead so a poor first fix doesn't widen the threshold forever.
        if (fix.accuracy < anchor.accuracy) {
            return {
                track: { anchor: fix, distance: track.distance },
                result: FixResult.STILL,
            };
        }

        return { track, result: FixResult.STILL };
    }

    const seconds = (fix.timestamp - anchor.timestamp) / 1000;

    if (seconds > 0 && moved / seconds > MAX_SPEED) {
        return { track, result: FixResult.JUMP };
    }

    return {
        track: { anchor: fix, distance: track.distance + moved },
        result: FixResult.MOVED,
    };
}

// Elapsed time that only runs while started.
export interface Stopwatch {
    // Milliseconds from earlier runs.
    banked: number;
    // When the current run began, or null when stopped.
    since: number | null;
}

export function newStopwatch(): Stopwatch {
    return { banked: 0, since: null };
}

export function startStopwatch(watch: Stopwatch, now: number): Stopwatch {
    return watch.since === null ? { banked: watch.banked, since: now } : watch;
}

export function stopStopwatch(watch: Stopwatch, now: number): Stopwatch {
    return { banked: elapsed(watch, now), since: null };
}

export function elapsed(watch: Stopwatch, now: number) {
    return watch.banked + (watch.since === null ? 0 : Math.max(0, now - watch.since));
}

// 0:05, 12:34, 1:02:03
export function formatDuration(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const ss = `${seconds}`.padStart(2, '0');

    if (hours) {
        return `${hours}:${`${minutes}`.padStart(2, '0')}:${ss}`;
    }

    return `${minutes}:${ss}`;
}

export const METERS_PER_MILE = 1609.344;

// Time per kilometer or mile, or '' when not moving enough to say.
export function formatPace(meters: number, ms: number, unitMeters: number) {
    if (meters < 10 || ms <= 0) {
        return '';
    }

    const perUnit = (ms / meters) * unitMeters;

    // Slower than 10 hours per unit means standing around, not a pace.
    if (perUnit > 36000000) {
        return '';
    }

    return formatDuration(perUnit);
}

export function estimateSteps(meters: number, strideMeters: number) {
    if (!(strideMeters > 0)) {
        return 0;
    }

    return Math.round(meters / strideMeters);
}

// Stride length limits, in meters.
export const STRIDE_MIN = 0.3;
export const STRIDE_MAX = 1.5;
export const STRIDE_DEFAULT = 0.75;

export function clampStride(stride: number | null | undefined) {
    if (typeof stride !== 'number' || !isFinite(stride)) {
        return STRIDE_DEFAULT;
    }

    return Math.min(STRIDE_MAX, Math.max(STRIDE_MIN, stride));
}
