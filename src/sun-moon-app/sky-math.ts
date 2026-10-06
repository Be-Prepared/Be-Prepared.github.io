// Pure helpers for the Sun & Moon screen. No DOM and no Fudgel, so they can
// be tested in Node. Altitudes and angles are in degrees, times are
// milliseconds since the epoch.

export type SkyBand =
    'night' | 'astronomical' | 'nautical' | 'civil' | 'golden' | 'day';

export interface SkySegment {
    band: SkyBand;
    end: number;
    start: number;
}

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

// The geometric sun altitudes suncalc's getTimes() uses for its events.
// Sunrise and sunset include refraction and the sun's radius.
export const SUNRISE_GEOMETRIC = -0.833;
const BAND_LIMITS: [number, SkyBand][] = [
    [-18, 'night'],
    [-12, 'astronomical'],
    [-6, 'nautical'],
    [SUNRISE_GEOMETRIC, 'civil'],
    [6, 'golden'],
];

// suncalc's getPosition() reports the apparent altitude: geometric plus
// atmospheric refraction (Meeus 16.4, held at its horizon value below 0°).
// The band limits are shifted the same way so the timeline agrees with the
// times listed from getTimes().
export function refraction(geometricDegrees: number) {
    const h = Math.max(0, geometricDegrees);

    return 1.02 / 60 / Math.tan(((h + 10.26 / (h + 5.1)) * Math.PI) / 180);
}

export function apparentAltitude(geometricDegrees: number) {
    return geometricDegrees + refraction(geometricDegrees);
}

const APPARENT_LIMITS: [number, SkyBand][] = BAND_LIMITS.map(
    ([limit, band]) => [apparentAltitude(limit), band]
);

export const SUNRISE_APPARENT = apparentAltitude(SUNRISE_GEOMETRIC);

export function bandForAltitude(apparentDegrees: number): SkyBand {
    for (const [limit, band] of APPARENT_LIMITS) {
        if (apparentDegrees < limit) {
            return band;
        }
    }

    return 'day';
}

// Splits [start, end) into runs of the same sky band. The altitude is
// sampled every stepMs and each change is narrowed down by bisection, which
// also copes with polar days and nights where suncalc has no event times.
export function computeDaySegments(
    start: number,
    end: number,
    altitudeAt: (time: number) => number,
    stepMs = 5 * MINUTE_MS,
    precisionMs = 5000
): SkySegment[] {
    const bandAt = (time: number) => bandForAltitude(altitudeAt(time));
    const segments: SkySegment[] = [];
    let current: SkySegment = { band: bandAt(start), start, end };

    const change = (time: number, band: SkyBand) => {
        current.end = time;
        segments.push(current);
        current = { band, start: time, end };
    };

    // Finds every band change in (a, b].
    const split = (a: number, bandA: SkyBand, b: number, bandB: SkyBand) => {
        if (b - a <= precisionMs) {
            change(b, bandB);

            return;
        }

        const middle = (a + b) / 2;
        const bandMiddle = bandAt(middle);

        if (bandMiddle !== bandA) {
            split(a, bandA, middle, bandMiddle);
        }

        if (bandMiddle !== bandB) {
            split(middle, bandMiddle, b, bandB);
        }
    };

    let previous = start;
    let previousBand = current.band;

    while (previous < end) {
        const next = Math.min(end, previous + stepMs);
        const nextBand = bandAt(next);

        if (nextBand !== previousBand) {
            split(previous, previousBand, next, nextBand);
        }

        previous = next;
        previousBand = nextBand;
    }

    current.end = end;

    if (current.end > current.start || !segments.length) {
        segments.push(current);
    }

    return segments;
}

export interface Crossing {
    rising: boolean;
    time: number;
}

// The next time after `from` that the altitude crosses `threshold`, looking
// up to `withinMs` ahead. Null when it stays on one side (polar day/night).
export function findNextCrossing(
    altitudeAt: (time: number) => number,
    from: number,
    threshold: number,
    withinMs = DAY_MS,
    stepMs = 5 * MINUTE_MS,
    precisionMs = 1000
): Crossing | null {
    let a = from;
    let aboveA = altitudeAt(a) >= threshold;

    while (a < from + withinMs) {
        const b = Math.min(from + withinMs, a + stepMs);
        const aboveB = altitudeAt(b) >= threshold;

        if (aboveB !== aboveA) {
            let low = a;
            let high = b;

            while (high - low > precisionMs) {
                const middle = (low + high) / 2;

                if (altitudeAt(middle) >= threshold === aboveA) {
                    low = middle;
                } else {
                    high = middle;
                }
            }

            return { rising: aboveB, time: high };
        }

        a = b;
        aboveA = aboveB;
    }

    return null;
}

// The next time the moon's phase (0 → 1, 0 = new, 0.5 = full) reaches the
// target. The phase only moves forward, so a change of sign in the wrapped
// difference marks the moment.
export function findNextPhase(
    phaseAt: (time: number) => number,
    from: number,
    target: number,
    withinMs = 35 * DAY_MS,
    stepMs = 6 * HOUR_MS,
    precisionMs = 30000
): number | null {
    const offset = (time: number) => {
        const diff = (((phaseAt(time) - target) % 1) + 1) % 1;

        return diff >= 0.5 ? diff - 1 : diff;
    };
    let a = from;
    let offsetA = offset(a);

    while (a < from + withinMs) {
        const b = a + stepMs;
        const offsetB = offset(b);

        // Only a small negative-to-positive step is the target; the jump
        // from +0.5 to -0.5 is the opposite phase.
        if (offsetA < 0 && offsetB >= 0 && offsetB - offsetA < 0.25) {
            let low = a;
            let high = b;

            while (high - low > precisionMs) {
                const middle = (low + high) / 2;

                if (offset(middle) < 0) {
                    low = middle;
                } else {
                    high = middle;
                }
            }

            return high;
        }

        a = b;
        offsetA = offsetB;
    }

    return null;
}

export type MoonPhaseName =
    | 'newMoon'
    | 'waxingCrescent'
    | 'firstQuarter'
    | 'waxingGibbous'
    | 'fullMoon'
    | 'waningGibbous'
    | 'lastQuarter'
    | 'waningCrescent';

const PHASE_NAMES: MoonPhaseName[] = [
    'newMoon',
    'waxingCrescent',
    'firstQuarter',
    'waxingGibbous',
    'fullMoon',
    'waningGibbous',
    'lastQuarter',
    'waningCrescent',
];

// Each named phase covers an eighth of the cycle, centered on its moment.
export function moonPhaseName(phase: number): MoonPhaseName {
    const wrapped = ((phase % 1) + 1) % 1;

    return PHASE_NAMES[Math.floor(wrapped * 8 + 0.5) % 8];
}

export function isValidTime(value: unknown): value is Date {
    return value instanceof Date && Number.isFinite(value.getTime());
}

// Length of daylight from the sun times. Null when it can't be told.
export function dayLength(
    sunrise: Date | null | undefined,
    sunset: Date | null | undefined,
    alwaysUp?: boolean,
    alwaysDown?: boolean
): number | null {
    if (isValidTime(sunrise) && isValidTime(sunset)) {
        return Math.max(0, sunset.getTime() - sunrise.getTime());
    }

    if (alwaysUp) {
        return DAY_MS;
    }

    if (alwaysDown) {
        return 0;
    }

    return null;
}

// Whole hours and minutes, rounded to the nearest minute.
export function splitDuration(ms: number) {
    const minutes = Math.max(0, Math.round(ms / MINUTE_MS));

    return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export function roundToMinute(time: number) {
    return Math.round(time / MINUTE_MS) * MINUTE_MS;
}

// Local midnight to the next local midnight. Daylight saving days are 23 or
// 25 hours long.
export function localDayBounds(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1
    );

    return { start: start.getTime(), end: end.getTime() };
}

// Calendar days between the local day of `time` and the day starting at
// `dayStart`, so times from a neighboring day can be marked.
export function dayOffset(time: number, dayStart: number) {
    const a = new Date(time);
    const b = new Date(dayStart);
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

    return Math.round((utcA - utcB) / DAY_MS);
}

// Position of a time on the day's bar, 0 to 1, or null when it's off the bar.
export function positionInDay(time: number, start: number, end: number) {
    if (!Number.isFinite(time) || time < start || time > end) {
        return null;
    }

    return (time - start) / (end - start);
}

export interface Marker {
    position: number;
    priority: number;
}

// Which marker labels fit without overlapping, given the minimum distance
// between label centers as a fraction of the bar. Higher priority wins.
export function visibleLabels(markers: Marker[], minGap: number): boolean[] {
    const order = markers
        .map((marker, index) => ({ ...marker, index }))
        .sort((a, b) => b.priority - a.priority || a.position - b.position);
    const shown: number[] = [];
    const result = markers.map(() => false);

    for (const marker of order) {
        if (shown.every((p) => Math.abs(p - marker.position) >= minGap)) {
            shown.push(marker.position);
            result[marker.index] = true;
        }
    }

    return result;
}

// The value a datetime-local input expects, in local time. toISOString()
// would give UTC and shift the shown time by the time zone offset.
export function toDateTimeLocalValue(date: Date) {
    const pad = (n: number) => `${n}`.padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "+34°", "−5°", "0°".
export function formatAltitude(degrees: number) {
    if (!Number.isFinite(degrees)) {
        return '';
    }

    const rounded = Math.round(degrees);

    if (rounded > 0) {
        return `+${rounded}°`;
    }

    if (rounded < 0) {
        return `−${-rounded}°`;
    }

    return '0°';
}

// City names have no digits; coordinates, MGRS, UTM and plus codes do.
export function looksLikeCoordinates(text: string) {
    return /\d/.test(text);
}
