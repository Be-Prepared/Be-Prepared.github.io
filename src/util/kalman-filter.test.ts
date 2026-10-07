import { KalmanFilter, KalmanFilterArray } from './kalman-filter';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the estimate moves toward measurements and the error shrinks', () => {
    const filter = new KalmanFilter({ initialEstimate: 0, initialErrorInEstimate: 10 });
    const [first, firstError] = filter.update({ measurement: 10, errorInMeasurement: 10 });
    assert.equal(first, 5);
    assert.equal(firstError, 5);
    const [second, secondError] = filter.update({ measurement: 10, errorInMeasurement: 10 });
    assert.ok(second > first && second < 10);
    assert.ok(secondError < firstError);
});

test('a precise measurement counts for more than a vague one', () => {
    const make = () => new KalmanFilter({ initialEstimate: 0, initialErrorInEstimate: 10 });
    const [precise] = make().update({ measurement: 10, errorInMeasurement: 1 });
    const [vague] = make().update({ measurement: 10, errorInMeasurement: 100 });
    assert.ok(precise > 9 && vague < 1);
});

test('the array filter treats each value separately', () => {
    const filter = new KalmanFilterArray({ initialEstimate: [0, 100], initialErrorInEstimate: 10 });
    const [estimates, error] = filter.update({ measurement: [10, 110], errorInMeasurement: 10 });
    assert.deepEqual(estimates, [5, 105]);
    assert.equal(error, 5);
});
