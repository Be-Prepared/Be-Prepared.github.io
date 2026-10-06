import assert from 'node:assert/strict';
import { isValidPoint } from './waypoint.service';
import { test } from 'node:test';

const point = { id: 1, lat: 38.9, lon: -77, created: 1700000000000, name: 'Home' };

test('a normal waypoint is valid', () => {
    assert.equal(isValidPoint(point), true);
});

test('zero coordinates are valid', () => {
    // Null Island and anywhere on the equator or prime meridian.
    assert.equal(isValidPoint({ ...point, lat: 0, lon: 0 }), true);
    assert.equal(isValidPoint({ ...point, created: 0 }), true);
});

test('broken waypoints are rejected', () => {
    assert.equal(isValidPoint(null), false);
    assert.equal(isValidPoint({ ...point, lat: '1' }), false);
    assert.equal(isValidPoint({ ...point, lon: NaN }), false);
    assert.equal(isValidPoint({ ...point, name: 5 }), false);
});
