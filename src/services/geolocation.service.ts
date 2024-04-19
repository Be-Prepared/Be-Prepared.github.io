import { AvailabilityState } from '../datatypes/availability-state';
import { BearingService } from './bearing.service';
import CheapRuler from 'cheap-ruler';
import { di } from 'fudgel';
import { finalize, share, switchMap } from 'rxjs/operators';
import { KalmanFilterArray } from '@bencevans/kalman-filter';
import { of } from 'rxjs';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import {
    PermissionsService,
    PermissionsServiceState,
} from './permissions.service';

export interface GeolocationCoordinateResultSuccess {
    timestamp: number;
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    speed: number; // If null, we calculate one
    heading: number; // If null, we calculate one or use NaN
}

export interface GeolocationCoordinateResultError {
    timestamp: number;
    error: GeolocationPositionError;
}

export type GeolocationCoordinateResult =
    | GeolocationCoordinateResultSuccess
    | GeolocationCoordinateResultError;

export class GeolocationService {
    #bearingService = di(BearingService);
    #permissionsService = di(PermissionsService);
    #observable: Observable<GeolocationCoordinateResult> | null = null;

    availabilityState() {
        if (!('geolocation' in navigator)) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this.#permissionsService.geolocation().pipe(
            switchMap((state) => {
                if (state === PermissionsServiceState.ERROR) {
                    return of(AvailabilityState.ERROR);
                }

                if (state === PermissionsServiceState.PROMPT) {
                    return of(AvailabilityState.PROMPT);
                }

                if (state === PermissionsServiceState.DENIED) {
                    return of(AvailabilityState.DENIED);
                }

                return of(AvailabilityState.ALLOWED);
            })
        );
    }

    getPosition() {
        const subject = new Subject<GeolocationCoordinateResult>();
        const lastPositions: GeolocationCoordinateResultSuccess[] = [];
        const success = (position: GeolocationPosition) => {
            const lastPosition: GeolocationCoordinateResultSuccess = {
                timestamp: position.timestamp,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                speed: position.coords.speed,
                heading: position.coords.heading,
            };

            lastPositions.push(lastPosition);

            if (lastPosition.speed === null || lastPosition.heading === null) {
                this.#calculateSpeedHeading(lastPositions);
            }

            subject.next(lastPosition);

            if (lastPositions.length > 5) {
                lastPositions.shift();
            }
        };
        const error = (error: GeolocationPositionError) => {
            lastPositions.splice(0, lastPositions.length);
            subject.next({
                timestamp: Date.now(),
                error,
            });
        };
        this.#observable = subject.asObservable().pipe(
            finalize(() => {
                navigator.geolocation.clearWatch(watch);
                this.#observable = null;
            }),
            share({
                connector: () => new ReplaySubject(1),
                resetOnRefCountZero: true,
            })
        );
        const watch = navigator.geolocation.watchPosition(success, error, {
            enableHighAccuracy: true,
        });

        return this.#observable;
    }

    #calculateSpeedHeading(
        lastPositions: GeolocationCoordinateResultSuccess[]
    ) {
        const first = lastPositions[0];
        const last = lastPositions[lastPositions.length - 1];

        if (lastPositions.length < 2) {
            if (last.speed === null) {
                last.speed = 0;
            }

            if (last.heading === null) {
                last.heading = NaN;
            }

            return;
        }

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

        const cheapRuler = new CheapRuler(last.latitude);
        const distance = cheapRuler.distance(
            [estimate[0][0], estimate[0][1]],
            [last.longitude, last.latitude]
        );
        const speed = distance / (((last.timestamp + first.timestamp) / 2) - first.timestamp);
        let heading: number;

        if (speed) {
            heading = this.#bearingService.standardize360(cheapRuler.bearing(
                [estimate[0][0], estimate[0][1]],
                [last.longitude, last.latitude]
            ));
        } else {
            heading = NaN;
        }

        if (last.speed === null) {
            last.speed = speed;
        }

        if (last.heading === null) {
            last.heading = heading;
        }
    }
}
