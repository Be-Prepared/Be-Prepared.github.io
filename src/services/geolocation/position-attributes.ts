// Pure per-fix calculations for GeolocationService: speed, heading, totals,
// and altitude statistics.

import type { GeolocationCoordinateResultSuccess } from '../geolocation.service';
import { initialVerticalState, updateVertical } from './vertical';
import { KalmanFilterArray } from '../../util/kalman-filter';
import { LatLon } from '../../datatypes/lat-lon';

const EXP = Math.exp(-1 / 5);
const EXP_INV = 1 - EXP;

// A very slow walk is about 1.2 km/h, which is around 0.35 m/s
export const SPEED_THRESHOLD = 0.35;

export interface PositionMath {
    bearing(from: LatLon, to: LatLon): number;
    distance(a: LatLon, b: LatLon): number;
}

// Updates the last entry of lastPositions using the ones before it.
//
// carried is the last good fix from before a location error. Its totals
// (distance traveled, time moving and stopped, maximums, first position,
// vertical stats) continue, but nothing is measured across the gap: a fix
// after a tunnel would otherwise count as one huge, fast jump.
export function calculateAttributes(
    lastPositions: GeolocationCoordinateResultSuccess[],
    math: PositionMath,
    carried: GeolocationCoordinateResultSuccess | null = null
) {
    const isNotSet = (value: any) => !value && value !== 0;
    const current = lastPositions[lastPositions.length - 1];
    const resumed = lastPositions.length === 1 && !!carried;
    const previous = resumed
        ? carried!
        : lastPositions[lastPositions.length - 2] || current;
    // Time between fixes that counts toward the totals.
    const elapsed = resumed ? 0 : current.timestamp - previous.timestamp;
    let speed = 0;
    let heading = NaN;
    let distance = 0;

    if (lastPositions.length > 1) {
        const result = calculateAverages(lastPositions, math);
        speed = result.speed;
        heading = result.heading;
        distance = result.distance;
    }

    current.speedSmoothed = exponentialMovingAverage(
        previous.speedSmoothed,
        speed
    );
    current.speedSmoothedMax = Math.max(
        current.speedSmoothed,
        previous.speedSmoothedMax
    );
    current.isMovingSmoothed = current.speedSmoothed >= SPEED_THRESHOLD;
    current.headingSmoothed = heading;

    if (isNotSet(current.speed)) {
        current.speed = speed;
    }

    if (isNotSet(current.heading)) {
        current.heading = heading;
    }

    // After the device's missing speed is replaced by the calculated one.
    current.speedMax = Math.max(current.speed, previous.speedMax);
    current.isMoving = current.speed >= SPEED_THRESHOLD;
    current.timeTotal = previous.timeTotal + elapsed;
    current.firstPosition = previous.firstPosition || previous;
    current.timeMoving = previous.timeMoving;
    current.timeStopped = previous.timeStopped;
    current.distanceTraveled = previous.distanceTraveled + distance;
    current.speedAvg = current.timeTotal
        ? current.distanceTraveled / (current.timeTotal / 1000)
        : 0;

    if (typeof current.altitude === 'number') {
        current.altitudeSum = previous.altitudeSum + (current.altitude || 0);
        current.altitudeCount = previous.altitudeCount + 1;
        current.altitudeMinimum = isNaN(previous.altitudeMinimum)
            ? current.altitude
            : Math.min(previous.altitudeMinimum, current.altitude);
        current.altitudeMaximum = isNaN(previous.altitudeMaximum)
            ? current.altitude
            : Math.max(previous.altitudeMaximum, current.altitude);
    } else {
        current.altitudeSum = previous.altitudeSum;
        current.altitudeCount = previous.altitudeCount;
        current.altitudeMinimum = previous.altitudeMinimum;
        current.altitudeMaximum = previous.altitudeMaximum;
    }

    current.vertical = updateVertical(
        previous === current ? initialVerticalState() : previous.vertical,
        current
    );

    if (current.isMoving) {
        current.timeMoving += elapsed;
    } else {
        current.timeStopped += elapsed;
    }
}

function calculateAverages(
    lastPositions: GeolocationCoordinateResultSuccess[],
    math: PositionMath
) {
    const first = lastPositions[0];
    const back1 = lastPositions[lastPositions.length - 2];
    const current = lastPositions[lastPositions.length - 1];
    const filter = new KalmanFilterArray({
        initialEstimate: [first.lon, first.lat],
        initialErrorInEstimate: first.accuracy,
    });

    let estimate: [number[], number] = [[0, 0], 0];

    for (let i = 1; i < lastPositions.length; i += 1) {
        estimate = filter.update({
            measurement: [lastPositions[i].lon, lastPositions[i].lat],
            errorInMeasurement: lastPositions[i].accuracy,
        }) as [number[], number];
    }

    const distance = math.distance(current, back1);
    const elapsedTime = current.timestamp - back1.timestamp;
    // Timestamps are milliseconds; speeds are meters per second.
    const speed = elapsedTime ? distance / (elapsedTime / 1000) : 0;
    let heading = NaN;

    if (speed > 0) {
        heading = math.bearing(
            {
                lat: estimate[0][1],
                lon: estimate[0][0],
            },
            current
        );
    }

    return {
        distance,
        heading,
        speed,
    };
}

// Big props to Linux's load average calculation and this guide
// https://www.fortra.com/resources/guides/unix-load-average-reweighed
function exponentialMovingAverage(previous: number, current: number) {
    // L(t) = L(t-1) * exp + n(t)(1 - exp)
    // L is load, t is time, exp is e^(-1/60) for the 1 minute average
    // sampled at 1 second intervals, n(t) is the new value.
    // exp and (1 - exp) are precalculated for performance.
    return previous * EXP + current * EXP_INV;
}
