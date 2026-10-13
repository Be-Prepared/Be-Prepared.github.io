import { AccessState } from './access/access-controller';
import { CoordinateService } from './coordinate.service';
import { di } from '../di';
import {
    distinctUntilChanged,
    filter,
    finalize,
    map,
    share,
    switchMap,
    tap,
} from 'rxjs/operators';
import { LatLon } from '../datatypes/lat-lon';
import {
    BehaviorSubject,
    Observable,
    of,
    ReplaySubject,
    Subject,
    timer,
} from 'rxjs';
import { PermissionStatus, watchPermission } from './access/permission-status';
import { calculateAttributes } from './geolocation/position-attributes';
import { initialVerticalState, VerticalState } from './geolocation/vertical';

// A refusal that comes back faster than this can't have been a person
// answering a prompt, so the browser refused on its own.
const QUICK_REFUSAL_MS = 2000;

// How long to show that a request is waiting for an answer. Browsers don't
// say when a prompt is ignored or dismissed, and some never answer at all.
const UNANSWERED_MS = 8000;

// For tests.
export interface GeolocationServiceOptions {
    clearTimeout?: (handle: any) => void;
    now?: () => number;
    permission?: () => Observable<PermissionStatus>;
    reload?: () => boolean;
    setTimeout?: (fn: () => void, ms: number) => any;
}

// Loads the page again, which is the only way to make Safari ask again after
// it has refused once. Not done when the page couldn't come back: offline
// without the service worker in control.
function reloadPage() {
    if (typeof location === 'undefined') {
        return false;
    }

    if (navigator.onLine === false && !navigator.serviceWorker?.controller) {
        return false;
    }

    location.reload();

    return true;
}

function stateFromStatus(status: PermissionStatus) {
    if (status === PermissionStatus.GRANTED) {
        return AccessState.READY;
    }

    if (status === PermissionStatus.DENIED) {
        return AccessState.DENIED;
    }

    return AccessState.PROMPT;
}

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
    private _options: Required<GeolocationServiceOptions>;
    // The browser refused a request since this page loaded. Safari then
    // refuses every later request from the same page without asking, even
    // after the setting that blocked it is fixed.
    private _refused = false;
    // How the last attempt to use the GPS went: a request() or a refusal on
    // the position watch. This is what really happened, so it counts for
    // more than the permission the browser reports, until the browser
    // reports a change. Only kept in memory; never saved.
    private _requestResult = new BehaviorSubject<AccessState | null>(null);
    private _restartDeniedWatch: (() => void) | null = null;
    // The browser reported the block before anything was asked, so it
    // remembers the block itself and loading the page again won't help.
    private _standingBlock = false;
    private _status: PermissionStatus | null = null;
    private _watchdog: any = null;

    constructor(options: GeolocationServiceOptions = {}) {
        this._options = {
            clearTimeout: (handle) => clearTimeout(handle),
            now: () => Date.now(),
            permission: () => watchPermission('geolocation'),
            reload: reloadPage,
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            ...options,
        };
    }

    // Looks at the permission without asking for it.
    availabilityState(): Observable<AccessState> {
        if (!this.isSupported()) {
            return of(AccessState.UNAVAILABLE);
        }

        return this._options.permission().pipe(
            tap((status) => this._statusSeen(status)),
            switchMap((status) =>
                this._requestResult.pipe(
                    map((requested) => requested || stateFromStatus(status))
                )
            ),
            distinctUntilChanged()
        );
    }

    isSupported() {
        return 'geolocation' in navigator;
    }

    // Shows the browser's prompt. Call from a button press.
    //
    // The state is CHECKING until the browser answers, so the press visibly
    // does something even when the browser refuses without a prompt.
    request() {
        const before = this._requestResult.value;
        const retry = this._refused;
        const started = this._options.now();
        const answer = (state: AccessState) => {
            this._options.clearTimeout(this._watchdog);
            this._requestResult.next(state);
        };

        this._options.clearTimeout(this._watchdog);
        this._requestResult.next(AccessState.CHECKING);
        this._watchdog = this._options.setTimeout(() => {
            // Bring the button back. A late answer still counts.
            if (this._requestResult.value === AccessState.CHECKING) {
                this._requestResult.next(
                    before === AccessState.CHECKING ? null : before
                );
            }
        }, UNANSWERED_MS);
        navigator.geolocation.getCurrentPosition(
            () => {
                this._refused = false;
                answer(AccessState.READY);
                this._restartDeniedWatch && this._restartDeniedWatch();
            },
            (error) => {
                if (error.code !== error.PERMISSION_DENIED) {
                    // Allowed, just no fix yet. The location screens show
                    // their own messages for that.
                    answer(AccessState.READY);

                    return;
                }

                const quick = this._options.now() - started < QUICK_REFUSAL_MS;
                this._refused = true;

                if (
                    retry &&
                    quick &&
                    !this._standingBlock &&
                    this._options.reload()
                ) {
                    // Refused again without asking. This page is stuck
                    // with the earlier refusal, so start over; the screen
                    // keeps showing that it's working until then.
                    this._options.clearTimeout(this._watchdog);

                    return;
                }

                answer(AccessState.DENIED);
            },
            // Only the answer to the permission matters here, so an old
            // position will do and there's no need to wait long for a fix.
            { maximumAge: Infinity, timeout: 3000 }
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
                // Whatever permission the browser reports, it isn't letting
                // this page have the position. Show how to fix that.
                this._refused = true;

                if (this._requestResult.value !== AccessState.CHECKING) {
                    this._requestResult.next(AccessState.DENIED);
                }
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

    private _statusSeen(status: PermissionStatus) {
        if (status === this._status) {
            return;
        }

        const first = this._status === null;
        this._status = status;
        this._standingBlock =
            status === PermissionStatus.DENIED && !this._refused;

        if (first) {
            return;
        }

        if (status !== PermissionStatus.DENIED) {
            // Only a browser that lets a page ask again reports this.
            this._refused = false;
        }

        // The browser has news since the last attempt, so it knows better.
        if (
            this._requestResult.value !== null &&
            this._requestResult.value !== AccessState.CHECKING
        ) {
            this._requestResult.next(null);
        }
    }

    getPositionSuccess(): Observable<GeolocationCoordinateResultSuccess> {
        return this.getPosition().pipe(
            filter((result) => result && result.success)
        ) as Observable<GeolocationCoordinateResultSuccess>;
    }
}
