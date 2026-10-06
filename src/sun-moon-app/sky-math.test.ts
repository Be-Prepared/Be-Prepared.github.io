import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as SunCalc from 'suncalc';
import {
    apparentAltitude,
    bandForAltitude,
    computeDaySegments,
    dayLength,
    dayOffset,
    DAY_MS,
    findNextCrossing,
    findNextPhase,
    formatAltitude,
    HOUR_MS,
    isValidTime,
    localDayBounds,
    looksLikeCoordinates,
    MINUTE_MS,
    moonPhaseName,
    positionInDay,
    roundToMinute,
    splitDuration,
    SUNRISE_APPARENT,
    toDateTimeLocalValue,
    visibleLabels,
} from './sky-math';

// A sun that rises and sets like a sine wave: -40° at midnight, +40° at noon.
const sineSun = (time: number) =>
    -40 * Math.cos(((time % DAY_MS) / DAY_MS) * 2 * Math.PI);

test('bandForAltitude follows the twilight limits', () => {
    assert.equal(bandForAltitude(-30), 'night');
    assert.equal(bandForAltitude(-15), 'astronomical');
    assert.equal(bandForAltitude(-9), 'nautical');
    assert.equal(bandForAltitude(-3), 'civil');
    assert.equal(bandForAltitude(3), 'golden');
    assert.equal(bandForAltitude(30), 'day');
    // Limits are apparent altitudes, so they sit a bit above the geometric.
    assert.equal(bandForAltitude(-17.6), 'night');
    assert.equal(bandForAltitude(-17.4), 'astronomical');
});

test('apparentAltitude adds about half a degree at the horizon', () => {
    assert.ok(Math.abs(apparentAltitude(-6) - -6 - 0.48) < 0.02);
    assert.ok(apparentAltitude(45) - 45 < 0.02);
    assert.ok(SUNRISE_APPARENT > -0.4 && SUNRISE_APPARENT < -0.3);
});

test('computeDaySegments covers the whole day in order', () => {
    const segments = computeDaySegments(0, DAY_MS, sineSun);

    assert.equal(segments[0].start, 0);
    assert.equal(segments[segments.length - 1].end, DAY_MS);

    for (let i = 1; i < segments.length; i += 1) {
        assert.equal(segments[i].start, segments[i - 1].end);
        assert.notEqual(segments[i].band, segments[i - 1].band);
    }

    assert.deepEqual(
        segments.map((s) => s.band),
        [
            'night',
            'astronomical',
            'nautical',
            'civil',
            'golden',
            'day',
            'golden',
            'civil',
            'nautical',
            'astronomical',
            'night',
        ]
    );
});

test('computeDaySegments finds boundaries to within seconds', () => {
    const segments = computeDaySegments(0, DAY_MS, sineSun);
    const day = segments.find((s) => s.band === 'day')!;
    // sin wave reaches the apparent 6° limit at acos(-limit / 40).
    const limit = apparentAltitude(6);
    const expected = (Math.acos(-limit / 40) / (2 * Math.PI)) * DAY_MS;

    assert.ok(Math.abs(day.start - expected) < 10000);
});

test('computeDaySegments finds several changes inside one step', () => {
    // Fast sun: crosses every band within one sampling step.
    const fast = (time: number) => -30 + time / 1000;
    const segments = computeDaySegments(0, 60000, fast, 60000, 100);

    assert.equal(segments.length, 6);
});

test('computeDaySegments handles polar day and night', () => {
    const up = computeDaySegments(0, DAY_MS, () => 20);
    const down = computeDaySegments(0, DAY_MS, () => -30);

    assert.deepEqual(up, [{ band: 'day', start: 0, end: DAY_MS }]);
    assert.deepEqual(down, [{ band: 'night', start: 0, end: DAY_MS }]);
});

test('computeDaySegments works with suncalc in Svalbard', () => {
    // UTC days, so the result doesn't depend on the test machine's zone.
    const juneStart = Date.UTC(2026, 5, 21);
    const decemberStart = Date.UTC(2026, 11, 21);
    const at = (time: number) =>
        SunCalc.getPosition(new Date(time), 78.22, 15.65).altitude;

    const summer = computeDaySegments(juneStart, juneStart + DAY_MS, at);
    const winter = computeDaySegments(
        decemberStart,
        decemberStart + DAY_MS,
        at
    );

    assert.deepEqual(
        summer.map((s) => s.band),
        ['day']
    );
    // The sun peaks near -12° at noon: dark twilight, never civil.
    assert.deepEqual(
        winter.map((s) => s.band),
        ['night', 'astronomical', 'nautical', 'astronomical', 'night']
    );
});

test('findNextCrossing finds the next sunset and sunrise', () => {
    const noon = DAY_MS / 2;
    const set = findNextCrossing(sineSun, noon, SUNRISE_APPARENT)!;

    assert.equal(set.rising, false);
    assert.ok(set.time > noon && set.time < DAY_MS);

    const rise = findNextCrossing(sineSun, set.time + 1000, SUNRISE_APPARENT)!;

    assert.equal(rise.rising, true);
    assert.ok(rise.time > DAY_MS && rise.time < DAY_MS * 1.5);
});

test('findNextCrossing matches suncalc sunset in Minneapolis', () => {
    const date = new Date(Date.UTC(2026, 9, 5, 17));
    const times = SunCalc.getTimes(date, 44.98, -93.26);
    const at = (time: number) =>
        SunCalc.getPosition(new Date(time), 44.98, -93.26).altitude;
    const crossing = findNextCrossing(at, date.getTime(), SUNRISE_APPARENT)!;

    assert.equal(crossing.rising, false);
    assert.ok(Math.abs(crossing.time - times.sunset!.getTime()) < MINUTE_MS);
});

test('findNextCrossing returns null when the sun never crosses', () => {
    assert.equal(
        findNextCrossing(() => 20, 0, SUNRISE_APPARENT),
        null
    );
});

test('findNextPhase finds full and new moons', () => {
    const phaseAt = (time: number) =>
        SunCalc.getMoonIllumination(new Date(time)).phase;
    const from = Date.UTC(2026, 9, 5);
    const full = findNextPhase(phaseAt, from, 0.5)!;
    const fresh = findNextPhase(phaseAt, from, 0)!;

    // Full moon 2026-10-26 04:12 UTC, new moon 2026-10-10 15:50 UTC.
    assert.ok(Math.abs(full - Date.UTC(2026, 9, 26, 4, 12)) < 30 * MINUTE_MS);
    assert.ok(Math.abs(fresh - Date.UTC(2026, 9, 10, 15, 50)) < 30 * MINUTE_MS);
});

test('findNextPhase with a synthetic phase', () => {
    const period = 29.5 * DAY_MS;
    const phaseAt = (time: number) => (time / period) % 1;

    assert.ok(Math.abs(findNextPhase(phaseAt, 0, 0.5)! - period / 2) < 60000);
    assert.ok(Math.abs(findNextPhase(phaseAt, 1000, 0)! - period) < 60000);
});

test('moonPhaseName', () => {
    assert.equal(moonPhaseName(0), 'newMoon');
    assert.equal(moonPhaseName(0.06), 'newMoon');
    assert.equal(moonPhaseName(0.1), 'waxingCrescent');
    assert.equal(moonPhaseName(0.25), 'firstQuarter');
    assert.equal(moonPhaseName(0.4), 'waxingGibbous');
    assert.equal(moonPhaseName(0.5), 'fullMoon');
    assert.equal(moonPhaseName(0.6), 'waningGibbous');
    assert.equal(moonPhaseName(0.75), 'lastQuarter');
    assert.equal(moonPhaseName(0.9), 'waningCrescent');
    assert.equal(moonPhaseName(0.97), 'newMoon');
    assert.equal(moonPhaseName(1), 'newMoon');
});

test('isValidTime', () => {
    assert.equal(isValidTime(new Date(0)), true);
    assert.equal(isValidTime(new Date(NaN)), false);
    assert.equal(isValidTime(null), false);
    assert.equal(isValidTime(undefined), false);
});

test('dayLength', () => {
    assert.equal(dayLength(new Date(1000), new Date(5000)), 4000);
    assert.equal(dayLength(null, null, true, false), DAY_MS);
    assert.equal(dayLength(new Date(NaN), new Date(NaN), false, true), 0);
    assert.equal(dayLength(null, null), null);
});

test('splitDuration rounds to the minute', () => {
    assert.deepEqual(splitDuration(0), { hours: 0, minutes: 0 });
    assert.deepEqual(splitDuration(HOUR_MS * 3 + MINUTE_MS * 12 + 31000), {
        hours: 3,
        minutes: 13,
    });
    assert.deepEqual(splitDuration(DAY_MS), { hours: 24, minutes: 0 });
    assert.deepEqual(splitDuration(-5), { hours: 0, minutes: 0 });
});

test('roundToMinute', () => {
    assert.equal(roundToMinute(29999), 0);
    assert.equal(roundToMinute(30000), 60000);
});

test('localDayBounds and dayOffset', () => {
    const date = new Date(2026, 9, 5, 15, 30);
    const { start, end } = localDayBounds(date);

    assert.equal(new Date(start).getHours(), 0);
    assert.equal(new Date(start).getDate(), 5);
    assert.equal(new Date(end).getDate(), 6);
    assert.equal(dayOffset(date.getTime(), start), 0);
    assert.equal(dayOffset(end + 1000, start), 1);
    assert.equal(dayOffset(start - 1000, start), -1);
});

test('positionInDay', () => {
    assert.equal(positionInDay(50, 0, 100), 0.5);
    assert.equal(positionInDay(150, 0, 100), null);
    assert.equal(positionInDay(NaN, 0, 100), null);
});

test('visibleLabels keeps important labels apart', () => {
    const markers = [
        { position: 0.3, priority: 2 },
        { position: 0.5, priority: 1 },
        { position: 0.7, priority: 2 },
    ];

    assert.deepEqual(visibleLabels(markers, 0.15), [true, true, true]);
    assert.deepEqual(visibleLabels(markers, 0.25), [true, false, true]);
    // Polar edge: sunrise and sunset close together around noon.
    assert.deepEqual(
        visibleLabels(
            [
                { position: 0.48, priority: 2 },
                { position: 0.5, priority: 1 },
                { position: 0.52, priority: 2 },
            ],
            0.15
        ),
        [true, false, false]
    );
});

test('toDateTimeLocalValue uses local time', () => {
    assert.equal(
        toDateTimeLocalValue(new Date(2026, 0, 2, 3, 4, 5)),
        '2026-01-02T03:04'
    );
});

test('formatAltitude', () => {
    assert.equal(formatAltitude(34.4), '+34°');
    assert.equal(formatAltitude(-12.6), '−13°');
    assert.equal(formatAltitude(-0.2), '0°');
    assert.equal(formatAltitude(NaN), '');
});

test('looksLikeCoordinates', () => {
    assert.equal(looksLikeCoordinates('Minneapolis'), false);
    assert.equal(looksLikeCoordinates('78.22 15.65'), true);
    assert.equal(looksLikeCoordinates('CWC8+R9'), true);
});
