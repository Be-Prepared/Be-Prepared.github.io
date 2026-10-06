import assert from 'node:assert/strict';
import { estimateTimeRemaining } from './time-estimate';
import { LatLon } from '../datatypes/lat-lon';
import { test } from 'node:test';

// Flat test space: one degree is one meter.
const distance = (a: LatLon, b: LatLon) =>
    Math.hypot(a.lat - b.lat, a.lon - b.lon);
const destination = { lat: 100, lon: 0 };

test('estimates from the rate of progress since the start', () => {
    // 20 m in 10 s, 80 m to go: 40 s.
    assert.equal(
        estimateTimeRemaining(
            { lat: 0, lon: 0, timestamp: 1000 },
            { lat: 20, lon: 0, timestamp: 11000 },
            destination,
            distance
        ),
        40000
    );
});

test('unknown without progress or elapsed time', () => {
    const start = { lat: 0, lon: 0, timestamp: 1000 };
    assert.equal(
        estimateTimeRemaining(start, start, destination, distance),
        null
    );
    assert.equal(
        estimateTimeRemaining(
            start,
            { lat: -10, lon: 0, timestamp: 5000 },
            destination,
            distance
        ),
        null,
        'moving away'
    );
    assert.equal(
        estimateTimeRemaining(
            start,
            { lat: 10, lon: 0, timestamp: 1000 },
            destination,
            distance
        ),
        null,
        'no time'
    );
});
