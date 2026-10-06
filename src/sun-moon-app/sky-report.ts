// Everything the Sun & Moon screen shows, as numbers, for one place and
// moment. Pure apart from suncalc, which is pure math, so it can be tested.
import * as SunCalc from 'suncalc';
import {
    computeDaySegments,
    Crossing,
    dayLength,
    DAY_MS,
    findNextCrossing,
    findNextPhase,
    HOUR_MS,
    isValidTime,
    localDayBounds,
    SkySegment,
    SUNRISE_APPARENT,
} from './sky-math';

export type SunTimeName =
    | 'nightEnd'
    | 'nauticalDawn'
    | 'dawn'
    | 'sunrise'
    | 'sunriseEnd'
    | 'goldenHourEnd'
    | 'solarNoon'
    | 'goldenHour'
    | 'sunsetStart'
    | 'sunset'
    | 'dusk'
    | 'nauticalDusk'
    | 'night'
    | 'nadir';

export interface SkyReport {
    dayEnd: number;
    dayStart: number;
    moon: {
        altitude: number;
        azimuth: number;
        alwaysDown: boolean;
        alwaysUp: boolean;
        fraction: number;
        // Next moonrise or moonset within 26 hours (a lunar day is about
        // 24 h 50 min), so it can reach into tomorrow.
        next: Crossing | null;
        nextFull: number | null;
        nextNew: number | null;
        phase: number;
        rise: number | null;
        set: number | null;
        waxing: boolean;
    };
    segments: SkySegment[];
    sun: {
        altitude: number;
        alwaysDown: boolean;
        alwaysUp: boolean;
        azimuth: number;
        dayLength: number | null;
        // Next sunrise or sunset within a day of the moment; null when the
        // sun stays up or down that long.
        next: Crossing | null;
        times: Record<SunTimeName, number | null>;
    };
    time: number;
}

const EARTH_RADIUS_KM = 6378.14;

const SUN_TIME_NAMES: SunTimeName[] = [
    'nightEnd',
    'nauticalDawn',
    'dawn',
    'sunrise',
    'sunriseEnd',
    'goldenHourEnd',
    'solarNoon',
    'goldenHour',
    'sunsetStart',
    'sunset',
    'dusk',
    'nauticalDusk',
    'night',
    'nadir',
];

function timeOrNull(value: unknown) {
    return isValidTime(value) ? value.getTime() : null;
}

export function computeSkyReport(
    date: Date,
    lat: number,
    lon: number
): SkyReport {
    const time = date.getTime();
    const { start, end } = localDayBounds(date);
    // Ask suncalc for the civil day the bar shows (local midnight to
    // midnight) instead of the solar day nearest the moment.
    const noon = new Date(start + (end - start) / 2);
    const utcOffset = -noon.getTimezoneOffset();
    const sunTimes = SunCalc.getTimes(noon, lat, lon, 0, utcOffset);
    const sunAt = (t: number) =>
        SunCalc.getPosition(new Date(t), lat, lon).altitude;
    const sunNow = SunCalc.getPosition(date, lat, lon);
    const times = {} as Record<SunTimeName, number | null>;

    for (const name of SUN_TIME_NAMES) {
        times[name] = timeOrNull(sunTimes[name]);
    }

    // suncalc's nadir is the one before solar noon, which can fall on the
    // previous day. The one after noon is then the lowest sun of this day.
    if (
        times.nadir !== null &&
        times.solarNoon !== null &&
        times.nadir < start
    ) {
        times.nadir = times.solarNoon + DAY_MS / 2;
    }

    const moonTimes = SunCalc.getMoonTimes(noon, lat, lon, utcOffset);
    const moonNow = SunCalc.getMoonPosition(date, lat, lon);
    const illumination = SunCalc.getMoonIllumination(date);
    // Height of the moon's upper edge over the horizon, the way suncalc's
    // getMoonTimes() decides moonrise and moonset.
    const moonAt = (t: number) => {
        const p = SunCalc.getMoonPosition(new Date(t), lat, lon);

        return (
            p.altitude +
            (0.2725 * Math.asin(EARTH_RADIUS_KM / p.distance) * 180) / Math.PI +
            0.09
        );
    };
    const phaseAt = (t: number) =>
        SunCalc.getMoonIllumination(new Date(t)).phase;

    return {
        dayEnd: end,
        dayStart: start,
        moon: {
            altitude: moonNow.altitude,
            alwaysDown: !!moonTimes.alwaysDown,
            alwaysUp: !!moonTimes.alwaysUp,
            azimuth: moonNow.azimuth,
            fraction: illumination.fraction,
            next: findNextCrossing(moonAt, time, 0, 26 * HOUR_MS),
            nextFull: findNextPhase(phaseAt, time, 0.5),
            nextNew: findNextPhase(phaseAt, time, 0),
            phase: illumination.phase,
            rise: timeOrNull(moonTimes.rise),
            set: timeOrNull(moonTimes.set),
            waxing: illumination.phase < 0.5,
        },
        segments: computeDaySegments(start, end, sunAt),
        sun: {
            altitude: sunNow.altitude,
            alwaysDown: !!sunTimes.alwaysDown,
            alwaysUp: !!sunTimes.alwaysUp,
            azimuth: sunNow.azimuth,
            dayLength: dayLength(
                sunTimes.sunrise,
                sunTimes.sunset,
                !!sunTimes.alwaysUp,
                !!sunTimes.alwaysDown
            ),
            next: findNextCrossing(sunAt, time, SUNRISE_APPARENT, DAY_MS),
            times,
        },
        time,
    };
}
