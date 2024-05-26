import { AvailabilityState } from '../datatypes/availability-state';
import { DirectionService } from './direction.service';
import CheapRuler from 'cheap-ruler';
import { di } from 'fudgel';
import { finalize, share, switchMap } from 'rxjs/operators';
import { KalmanFilterArray } from '@bencevans/kalman-filter';
import { of, timer } from 'rxjs';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { PermissionsService } from './permissions.service';

const EXP = Math.exp(-1 / 5);
const EXP_INV = 1 - EXP;

// A very slow walk is about 1.2 km/h, which is around 0.35 m/s
const SPEED_THRESHOLD = 0.35;

export interface GeolocationCoordinateResultSuccess {
    success: true;
    timestamp: number;
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    speed: number; // If null, we calculate one in m/s
    heading: number; // If null, we calculate one or use NaN
    isMoving: boolean;
    timeMoving: number;
    timeStopped: number;
    timeTotal: number;
    firstPosition: GeolocationCoordinateResultSuccess | null;
    smoothedSpeed: number;
    smoothedMoving: boolean;
}

export interface GeolocationCoordinateResultError {
    success: false;
    timestamp: number;
    error: GeolocationPositionError;
}

export type GeolocationCoordinateResult =
    | GeolocationCoordinateResultSuccess
    | GeolocationCoordinateResultError;

export class GeolocationService {
    private _directionService = di(DirectionService);
    private _observable: Observable<GeolocationCoordinateResult> | null = null;
    private _permissionsService = di(PermissionsService);

    availabilityState() {
        if (!('geolocation' in navigator)) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this._permissionsService.geolocation().pipe(
            switchMap((state) => {
                return this._permissionsService.toAvailability(state);
            })
        );
    }

    getPosition() {
        if (this._observable) {
            return this._observable;
        }

        const subject = new Subject<GeolocationCoordinateResult>();
        const lastPositions: GeolocationCoordinateResultSuccess[] = [];
        const success = (position: GeolocationPosition) => {
            const thisPosition: GeolocationCoordinateResultSuccess = {
                success: true,
                timestamp: position.timestamp,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                // NULL values are calculated later
                speed: position.coords.speed as any,
                heading: position.coords.heading as any,
                // Computed
                firstPosition: null,
                isMoving: false,
                timeMoving: 0,
                timeStopped: 0,
                timeTotal: 0,
                smoothedSpeed: 0,
                smoothedMoving: false,
            };

            lastPositions.push(thisPosition);
            this._calculateAttributes(lastPositions);
            subject.next(thisPosition);

            if (lastPositions.length > 5) {
                lastPositions.shift();
            }
        };
        const error = (error: GeolocationPositionError) => {
            lastPositions.splice(0, lastPositions.length);
            subject.next({
                success: false,
                timestamp: Date.now(),
                error,
            });
        };
        this._observable = subject.asObservable().pipe(
            finalize(() => {
                navigator.geolocation.clearWatch(watch);
                this._observable = null;
            }),
            share({
                connector: () => new ReplaySubject(1),
                resetOnRefCountZero: () => timer(5000),
            })
        );
        navigator.geolocation.getCurrentPosition(success, error);
        const watch = navigator.geolocation.watchPosition(success, error, {
            enableHighAccuracy: true,
        });

        return this._observable;
    }

    private _calculateAttributes(
        lastPositions: GeolocationCoordinateResultSuccess[]
    ) {
        const isNotSet = (value: any) => !value && value !== 0;
        const current = lastPositions[lastPositions.length - 1];
        const previous = lastPositions[lastPositions.length - 2] || current;
        let speed = 0;
        let heading = NaN;

        if (lastPositions.length > 1) {
            const result = this._calculateAverages(lastPositions);
            speed = result.speed;
            heading = result.heading;
        }

        current.smoothedSpeed = this._exponentialMovingAverage(previous.smoothedSpeed);
        current.smoothedMoving = current.smoothedSpeed >= SPEED_THRESHOLD;

        if (isNotSet(current.speed)) {
            current.speed = speed;
        }

        if (isNotSet(current.heading)) {
            current.heading = heading;
        }

        current.isMoving = current.speed >= SPEED_THRESHOLD;
        current.timeTotal = current.timestamp - previous.timestamp;
        current.firstPosition = previous;
        current.timeMoving = previous.timeMoving;
        current.timeStopped = previous.timeStopped;

        if (current.isMoving) {
            current.timeMoving += current.timestamp - previous.timestamp;
        } else {
            current.timeStopped += current.timestamp - previous.timestamp;
        }
    }

    private _calculateAverages(lastPositions: GeolocationCoordinateResultSuccess[]) {
        const first = lastPositions[0];
        const back1 = lastPositions[lastPositions.length - 2];
        const current = lastPositions[lastPositions.length - 1];
        const filter = new KalmanFilterArray({
            initialEstimate: [first.longitude, first.latitude],
            initialErrorInEstimate: first.accuracy,
        });

        let estimate: [number[], number] = [[0, 0], 0];

        for (let i = 1; i < lastPositions.length; i += 1) {
            estimate = filter.update({
                measurement: [
                    lastPositions[i].longitude,
                    lastPositions[i].latitude,
                ],
                errorInMeasurement: lastPositions[i].accuracy,
            }) as [number[], number];
        }

        const cheapRuler = new CheapRuler(current.latitude, 'meters');
        const distance = cheapRuler.distance(
            [back1.longitude, back1.latitude],
            [current.longitude, current.latitude]
        );
        const elapsedTime = current.timestamp - back1.timestamp;
        const speed = elapsedTime ? distance / elapsedTime : 0;
            (current.timestamp + first.timestamp) / 2 - first.timestamp;
        let heading = NaN;

        if (speed > 0) {
            // Calculates the heading, not the bearing
            heading = this._directionService.standardize360(
                cheapRuler.bearing(
                    [estimate[0][0], estimate[0][1]],
                    [current.longitude, current.latitude]
                )
            );
        }

        return {
            heading,
            speed
        };
    }

    // Big props to Linux's load average calculation and this guide
    // https://www.fortra.com/resources/guides/unix-load-average-reweighed
    private _exponentialMovingAverage(previous: number, current: number) {
        // L(t) = L(t-1) * exp + n(t)(1 - exp)
        // L is load, t is time, exp is e^(-1/60) for the 1 minute average
        // sampled at 1 second intervals, n(t) is the new value.
        // exp and (1 - exp) are precalculated for performance.
        return previous * EXP + current * EXP_INV;
    }
}
