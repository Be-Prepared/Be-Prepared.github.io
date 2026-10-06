import { AccessState } from './access/access-controller';
import { CoordinateService } from './coordinate.service';
import { di } from '../di';
import { distinctUntilChanged, filter, finalize, map, share } from 'rxjs/operators';
import { LatLon } from '../datatypes/lat-lon';
import { combineLatest, Observable, of, ReplaySubject, Subject, timer } from 'rxjs';
import { PermissionStatus, watchPermission } from './access/permission-status';
import { calculateAttributes } from './geolocation/position-attributes';
import { initialVerticalState, VerticalState } from './geolocation/vertical';

export interface GeolocationCoordinateResultSuccess extends LatLon {
    success: true;
    timestamp: number;
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
    headingSmoothed: number;
    speedAvg: number;
    speedMax: number;
    speedSmoothed: number;
    speedSmoothedMax: number;
    isMovingSmoothed: boolean;
    altitudeSum: number;
    altitudeCount: number;
    altitudeMinimum: number;
    altitudeMaximum: number;
    distanceTraveled: number;
    // Smoothed altitude, ascent, descent, and glide window. Read it with the
    // helpers in geolocation/vertical.ts.
    vertical: VerticalState;
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
    private _coordinateService = di(CoordinateService);
    private _observable: Observable<GeolocationCoordinateResult> | null = null;
    // Outcome of the last request() during this run of the app. Only kept in
    // memory because iOS doesn't report permission changes; never saved.
    private _requestResult = new ReplaySubject<AccessState | null>(1);
    private _restartDeniedWatch: (() => void) | null = null;

    constructor() {
        this._requestResult.next(null);
    }

    // Looks at the permission without asking for it.
    availabilityState(): Observable<AccessState> {
        if (!this.isSupported()) {
            return of(AccessState.UNAVAILABLE);
        }

        return combineLatest([
            watchPermission('geolocation'),
            this._requestResult,
        ]).pipe(
            map(([status, requested]) => {
                if (status === PermissionStatus.GRANTED) {
                    return AccessState.READY;
                }

                if (status === PermissionStatus.DENIED) {
                    return AccessState.DENIED;
                }

                return requested || AccessState.PROMPT;
            }),
            distinctUntilChanged()
        );
    }

    isSupported() {
        return 'geolocation' in navigator;
    }

    // Shows the browser's prompt. Call from a button press.
    request() {
        navigator.geolocation.getCurrentPosition(
            () => {
                this._requestResult.next(AccessState.READY);
                this._restartDeniedWatch && this._restartDeniedWatch();
            },
            (error) =>
                this._requestResult.next(
                    error.code === error.PERMISSION_DENIED
                        ? AccessState.DENIED
                        : // Allowed, just no fix yet. The location screens
                          // show their own messages for that.
                          AccessState.READY
                ),
            { timeout: 10000 }
        );
    }

    getPosition() {
        if (this._observable) {
            // A watch that was refused permission is dead. Start it again in
            // case permission was granted since then.
            this._restartDeniedWatch && this._restartDeniedWatch();

            return this._observable;
        }

        const subject = new Subject<GeolocationCoordinateResult>();
        const lastPositions: GeolocationCoordinateResultSuccess[] = [];
        // Last good fix before an error, so totals survive a tunnel.
        let carried: GeolocationCoordinateResultSuccess | null = null;
        let watch: number | null = null;
        let denied = false;
        const success = (position: GeolocationPosition) => {
            const thisPosition: GeolocationCoordinateResultSuccess = {
                success: true,
                timestamp: position.timestamp,
                lat: position.coords.latitude,
                lon: position.coords.longitude,
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
                speedAvg: 0,
                speedMax: 0,
                speedSmoothed: 0,
                speedSmoothedMax: 0,
                isMovingSmoothed: false,
                headingSmoothed: NaN,
                altitudeSum: 0,
                altitudeCount: 0,
                altitudeMinimum: NaN,
                altitudeMaximum: NaN,
                distanceTraveled: 0,
                vertical: initialVerticalState(),
            };

            lastPositions.push(thisPosition);
            calculateAttributes(lastPositions, this._coordinateService, carried);
            carried = null;
            subject.next(thisPosition);

            if (lastPositions.length > 4) {
                lastPositions.shift();
            }
        };
        const error = (error: GeolocationPositionError) => {
            // Only the speed and heading baseline is reset; the totals carry
            // on from the last good fix.
            carried = lastPositions[lastPositions.length - 1] || carried;
            lastPositions.splice(0, lastPositions.length);

            if (error.code === error.PERMISSION_DENIED) {
                // The browser never reports anything on this watch again.
                denied = true;
                stopWatch();
            }

            subject.next({
                success: false,
                timestamp: Date.now(),
                error,
            });
        };
        const stopWatch = () => {
            if (watch !== null) {
                navigator.geolocation.clearWatch(watch);
                watch = null;
            }
        };
        const startWatch = () => {
            denied = false;
            navigator.geolocation.getCurrentPosition(success, error);
            watch = navigator.geolocation.watchPosition(success, error, {
                enableHighAccuracy: true,
            });

            // In case the denial was reported before watchPosition returned.
            if (denied) {
                stopWatch();
            }
        };
        this._restartDeniedWatch = () => {
            if (denied) {
                startWatch();
            }
        };
        this._observable = subject.asObservable().pipe(
            finalize(() => {
                stopWatch();
                this._observable = null;
                this._restartDeniedWatch = null;
            }),
            share({
                connector: () => new ReplaySubject(1),
                resetOnRefCountZero: () => timer(5000),
            })
        );
        startWatch();

        return this._observable;
    }

    getPositionSuccess(): Observable<GeolocationCoordinateResultSuccess> {
        return this.getPosition().pipe(
            filter((result) => result && result.success)
        ) as Observable<GeolocationCoordinateResultSuccess>;
    }
}
