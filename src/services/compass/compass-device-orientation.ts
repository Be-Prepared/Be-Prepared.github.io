import { AvailabilityState } from '../../datatypes/availability-state';
import {
    catchError,
    finalize,
    first,
    map,
    share,
    tap,
    timeout,
} from 'rxjs/operators';
import { CompassInterface } from './compass-interface';
import { DEGREES_TO_RADIANS, RADIANS_TO_DEGREES, TWO_PI } from '../../shared/radians';
import { from, Observable, of, ReplaySubject, Subject } from 'rxjs';

const USES_ABSOLUTE_LISTENER = 'ondeviceorientationabsolute' in window;

export class CompassDeviceOrientation implements CompassInterface {
    private _observable: Observable<number> | null = null;
    private _prompted = false;
    private _eventListener: ((event: DeviceOrientationEvent) => void) | null =
        null;
    private _eventName?: 'deviceorientation' | 'deviceorientationabsolute';

    availabilityState() {
        if (!window.DeviceOrientationEvent) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this.getCompassBearing().pipe(
            first(),
            timeout(1000),
            map(() => AvailabilityState.ALLOWED),
            catchError((error) => {
                if (!this._prompted && error.name === 'TimeoutError') {
                    return of(AvailabilityState.PROMPT);
                }

                return of(AvailabilityState.ERROR);
            })
        );
    }

    getCompassBearing() {
        if (!this._observable) {
            this._observe();
        }

        return this._observable!;
    }

    prompt() {
        this._prompted = true;

        if ((window.DeviceOrientationEvent as any).requestPermission) {
            // iOS has a static method to request permission
            return from(
                (window.DeviceOrientationEvent as any).requestPermission(true)
            ).pipe(
                catchError(() => of(null)),
                tap(() => this._recreateEventListener())
            );
        }

        return of(null);
    }

    type() {
        if (USES_ABSOLUTE_LISTENER) {
            return 'DEVICE_ORIENTATION_ABSOLUTE';
        }

        return 'DEVICE_ORIENTATION';
    }

    private _convertToCompassBearing(
        alpha: number,
        beta: number,
        gamma: number
    ) {
        // Convert degrees to radians
        const alphaRad = alpha * DEGREES_TO_RADIANS;
        const betaRad = beta * DEGREES_TO_RADIANS;
        const gammaRad = gamma * DEGREES_TO_RADIANS;

        // Calculate equation components
        const cA = Math.cos(alphaRad);
        const sA = Math.sin(alphaRad);
        const sB = Math.sin(betaRad);
        const cG = Math.cos(gammaRad);
        const sG = Math.sin(gammaRad);

        // Calculate A, B, C rotation components
        const rA = -cA * sG - sA * sB * cG;
        const rB = -sA * sG + cA * sB * cG;

        // Calculate compass bearing
        let bearing = Math.atan(rA / rB);

        // Convert from half unit circle to whole unit circle
        if (rB < 0) {
            bearing += Math.PI;
        } else if (rA < 0) {
            bearing += TWO_PI;
        }

        // Convert radians to degrees
        bearing *= RADIANS_TO_DEGREES;

        return bearing;
    }

    private _observe() {
        this._eventName = USES_ABSOLUTE_LISTENER
            ? 'deviceorientationabsolute'
            : 'deviceorientation';
        const subject = new Subject<number>();
        let lastWebkitCompassHeading: number | null = null;
        let lastAlpha: number | null = null;
        let lastBeta: number | null = null;
        let lastGamma: number | null = null;
        this._eventListener = (event: DeviceOrientationEvent) => {
            // Webkit doesn't use "alpha" correctly, but that's ok because it
            // provides webkitCompassHeading.
            // https://stackoverflow.com/questions/16048514/can-i-use-javascript-to-get-the-compass-heading-for-ios-and-android/26275869#answer-27390389
            if (typeof (event as any).webkitCompassHeading === 'number') {
                // Note that "bearing" is the direction you are facing,
                // "heading" is the direction you are moving. Compasses show
                // bearing, or a direction to a point.
                if (
                    lastWebkitCompassHeading ===
                    (event as any).webkitCompassHeading
                ) {
                    return;
                }

                lastWebkitCompassHeading = (event as any).webkitCompassHeading;
                subject.next(lastWebkitCompassHeading!);

                return;
            }

            if (!USES_ABSOLUTE_LISTENER && !event.absolute) {
                subject.error(new Error('Unsupported'));

                return;
            }

            if (
                event.alpha === null ||
                event.beta === null ||
                event.gamma === null
            ) {
                subject.error(new Error('Unsupported'));

                return;
            }

            if (
                lastAlpha === event.alpha &&
                lastBeta === event.beta &&
                lastGamma === event.gamma
            ) {
                return;
            }

            lastAlpha = event.alpha;
            lastBeta = event.beta;
            lastGamma = event.gamma;
            subject.next(
                this._convertToCompassBearing(lastAlpha, lastBeta, lastGamma)
            );
        };
        this._observable = subject.asObservable().pipe(
            finalize(() => {
                window.removeEventListener(
                    this._eventName!,
                    this._eventListener!
                );
                this._observable = null;
            }),
            share({
                connector: () => new ReplaySubject(1),
                resetOnRefCountZero: true,
            })
        );
        window.addEventListener(this._eventName, this._eventListener);
    }

    private _recreateEventListener() {
        const listener = this._eventListener;
        const eventName = this._eventName;

        if (listener && eventName) {
            window.removeEventListener(eventName, listener);
            window.addEventListener(eventName, listener);
        }
    }
}
