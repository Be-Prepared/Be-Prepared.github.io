import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeSkyReport } from './sky-report';
import { DAY_MS, HOUR_MS, MINUTE_MS } from './sky-math';

test('computeSkyReport for Minneapolis in October', () => {
    const date = new Date(2026, 9, 5, 12);
    const report = computeSkyReport(date, 44.98, -93.26);
    const { times } = report.sun;

    assert.ok(
        times.sunrise! < times.solarNoon! && times.solarNoon! < times.sunset!
    );
    assert.ok(
        times.nightEnd! < times.nauticalDawn! && times.dawn! < times.sunrise!
    );
    assert.equal(report.sun.alwaysUp, false);
    assert.equal(report.sun.alwaysDown, false);
    // About 11 h 30 min of daylight in early October.
    assert.ok(
        Math.abs(report.sun.dayLength! - (11 * HOUR_MS + 30 * MINUTE_MS)) <
            15 * MINUTE_MS
    );
    assert.equal(report.segments[0].start, report.dayStart);
    assert.equal(
        report.segments[report.segments.length - 1].end,
        report.dayEnd
    );
    assert.ok(report.sun.next);
    assert.ok(report.moon.fraction >= 0 && report.moon.fraction <= 1);
    assert.ok(report.moon.nextFull! > date.getTime());
    assert.ok(report.moon.nextNew! > date.getTime());
    assert.ok(report.moon.nextFull! - date.getTime() < 31 * DAY_MS);
    // The next moonrise or moonset matches one of suncalc's.
    const next = report.moon.next!;
    const listed = [report.moon.rise, report.moon.set].filter(
        (t) => t !== null && Math.abs(t - next.time) < 2 * MINUTE_MS
    );

    if (next.time < report.dayEnd) {
        assert.equal(listed.length, 1);
    }
});

test('computeSkyReport positions are in degrees', () => {
    // Solar noon in Minneapolis on 2026-10-05 is about 18:01 UTC; the sun
    // stands near 90 - 45 - 5 = 40 degrees, due south.
    const noon = computeSkyReport(
        new Date(Date.UTC(2026, 9, 5, 18)),
        44.98,
        -93.26
    );

    assert.ok(Math.abs(noon.sun.altitude - 40) < 2);
    assert.ok(Math.abs(noon.sun.azimuth - 180) < 5);

    // Six hours later it has just set in the west: a negative altitude, not
    // a large positive angle.
    const evening = computeSkyReport(
        new Date(Date.UTC(2026, 9, 6, 0)),
        44.98,
        -93.26
    );

    assert.ok(evening.sun.altitude < 0 && evening.sun.altitude > -10);
    assert.ok(evening.sun.azimuth > 240 && evening.sun.azimuth < 300);
    assert.ok(Math.abs(evening.moon.altitude) <= 90);
    assert.ok(evening.moon.azimuth >= 0 && evening.moon.azimuth < 360);
});

test('computeSkyReport during the midnight sun', () => {
    const report = computeSkyReport(new Date(2026, 5, 21, 12), 78.22, 15.65);

    assert.equal(report.sun.alwaysUp, true);
    assert.equal(report.sun.times.sunrise, null);
    assert.equal(report.sun.times.sunset, null);
    assert.equal(report.sun.dayLength, DAY_MS);
    assert.equal(report.sun.next, null);
    assert.deepEqual(
        report.segments.map((s) => s.band),
        ['day']
    );
    assert.ok(report.sun.times.solarNoon !== null);
    // The lowest sun is reported on the day shown.
    assert.ok(report.sun.times.nadir! >= report.dayStart);
    assert.ok(report.sun.times.nadir! < report.dayEnd);
});

test('computeSkyReport during the polar night', () => {
    const report = computeSkyReport(new Date(2026, 11, 21, 12), 78.22, 15.65);

    assert.equal(report.sun.alwaysDown, true);
    assert.equal(report.sun.dayLength, 0);
    assert.equal(report.sun.next, null);
    assert.ok(report.segments.every((s) => s.band !== 'day'));
});
