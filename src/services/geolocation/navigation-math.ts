// Pure helpers for the navigation and vertical speed location fields.

export type RelativeSide = 'AHEAD' | 'BEHIND' | 'LEFT' | 'RIGHT';

// Angle from the current heading to the destination, in [-180, 180).
// Negative means the destination is to the left, positive to the right.
export function relativeBearing(
    bearingToDestination: number,
    heading: number
): number {
    const diff = (((bearingToDestination - heading) % 360) + 360) % 360;

    return diff >= 180 ? diff - 360 : diff;
}

export function describeRelativeBearing(relative: number): {
    degrees: number;
    side: RelativeSide;
} {
    const degrees = Math.abs(Math.round(relative));

    if (degrees === 0) {
        return { degrees, side: 'AHEAD' };
    }

    if (degrees >= 180) {
        return { degrees: 180, side: 'BEHIND' };
    }

    return { degrees, side: relative < 0 ? 'LEFT' : 'RIGHT' };
}

// The part of the current speed that closes the distance to the destination.
// Negative while moving away. NaN when moving without a known heading.
export function velocityMadeGood(
    speed: number,
    bearingToDestination: number,
    heading: number
): number {
    if (!speed) {
        return 0;
    }

    if (isNaN(heading) || isNaN(bearingToDestination)) {
        return NaN;
    }

    const angle =
        (relativeBearing(bearingToDestination, heading) * Math.PI) / 180;

    return speed * Math.cos(angle);
}

const FEET_PER_METER = 3.2808398950131;

// Vertical speeds follow the aviation convention: meters per second for
// metric and feet per minute for imperial.
export function formatVerticalSpeed(
    metersPerSecond: number,
    metric: boolean,
    signed = false,
    locale?: string
): string {
    let value: number;
    let digits: number;
    let unit: string;

    if (metric) {
        value = metersPerSecond;
        const abs = Math.abs(value);
        digits = abs < 1 ? 2 : abs < 10 ? 1 : 0;
        unit = 'm/s';
    } else {
        value = metersPerSecond * FEET_PER_METER * 60;
        digits = 0;
        unit = 'ft/min';
    }

    const factor = Math.pow(10, digits);
    value = Math.round(value * factor) / factor;

    // Avoid "-0".
    if (value === 0) {
        value = 0;
    }

    const text = Math.abs(value).toLocaleString(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
    let sign = value < 0 ? '-' : '';

    if (signed && value > 0) {
        sign = '+';
    }

    return `${sign}${text} ${unit}`;
}

export function formatGlideRatio(ratio: number, locale?: string): string {
    const digits = ratio < 10 ? 1 : 0;

    return ratio.toLocaleString(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}
