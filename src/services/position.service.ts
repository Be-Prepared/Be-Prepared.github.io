import { AvailabilityState } from '../datatypes/availability-state';
import { catchError, finalize, first, map, share } from 'rxjs/operators';
import { di } from 'fudgel';
import { DirectionService } from './direction.service';
import { of, throwError } from 'rxjs';
import { Observable, ReplaySubject, Subject } from 'rxjs';

export type PositionEvent =
    | PositionEventBearing
    | PositionEventDeviceOrientation
    | PositionEventQuaternion;

export interface PositionEventBearing {
    bearing: number;
}

export interface PositionEventDeviceOrientation {
    alpha: number;
    beta: number;
    gamma: number;
}

export interface PositionEventQuaternion {
    quaternion: number[];
}

export class PositionService {
    private _directionService = di(DirectionService);
    private _observable: Observable<PositionEvent> | null = null;

    availabilityState() {
        if (
            !(
                'AbsoluteOrientationSensor' in window ||
                'ondeviceorientationabsolute' in window
            )
        ) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this._checkAvailability();
    }

    getCompassBearing() {
        return this.getLocationEvents().pipe(
            map((event: PositionEvent) => {
                if ('alpha' in event) {
                    return this._convertDeviceOrientationToBearing(event);
                }

                if ('quaternion' in event) {
                    return this._convertQuaternionToBearing(event);
                }

                return event.bearing;
            }),
            map((bearing) => this._directionService.standardize360(bearing)),
            share({
                connector: () => new ReplaySubject(1),
                resetOnRefCountZero: true,
            })
        );
    }

    getLocationEvents() {
        if (!this._observable) {
            if ('AbsoluteOrientationSensor' in window) {
                this._listenAbsoluteOrientationSensor();
            } else {
                this._listenDeviceOrientationAbsolute();
            }
        }

        return this._observable!;
    }

    private _checkAvailability() {
        return this.getLocationEvents().pipe(
            map(() => AvailabilityState.ALLOWED),
            catchError(() => of(AvailabilityState.UNAVAILABLE)),
            first()
        );
    }

    private _convertDeviceOrientationToBearing(
        event: PositionEventDeviceOrientation
    ): number {
        // Convert degrees to radians
        const alphaRad = event.alpha * (Math.PI / 180);
        const betaRad = event.beta * (Math.PI / 180);
        const gammaRad = event.gamma * (Math.PI / 180);

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
            bearing += 2 * Math.PI;
        }

        // Convert radians to degrees
        bearing *= 180 / Math.PI;

        return bearing;
    }

    private _convertQuaternionToBearing(
        event: PositionEventQuaternion
    ): number {
        const q = event.quaternion;
        const alpha =
            Math.atan2(
                2 * q[0] * q[1] + 2 * q[2] * q[3],
                1 - 2 * q[1] * q[1] - 2 * q[2] * q[2]
            ) *
            (180 / Math.PI);
        const bearing = alpha < 0 ? alpha + 360 : alpha;

        return 360 - bearing;
    }

    private _listenAbsoluteOrientationSensor() {
        try {
            const sensor = new AbsoluteOrientationSensor({
                frequency: 60,
                referenceFrame: 'screen',
            });
            const subject = new Subject<PositionEventQuaternion>();
            const lastQuaternion = new Float32Array(4);
            sensor.addEventListener('reading', () => {
                if (sensor.quaternion) {
                    if (
                        sensor.quaternion[0] === lastQuaternion[0] &&
                        sensor.quaternion[1] === lastQuaternion[1] &&
                        sensor.quaternion[2] === lastQuaternion[2] &&
                        sensor.quaternion[3] === lastQuaternion[3]
                    ) {
                        return;
                    }

                    lastQuaternion.set(sensor.quaternion);
                    subject.next({
                        quaternion: sensor.quaternion,
                    });
                }
            });
            sensor.addEventListener('error', (event) => {
                subject.error(event);
            });
            sensor.start();
            this._observable = subject.asObservable().pipe(
                finalize(() => {
                    sensor.stop();
                    this._observable = null;
                }),
                share({
                    connector: () => new ReplaySubject(1),
                    resetOnRefCountZero: true,
                })
            );
        } catch (ignore) {
            this._observable = throwError(new Error('Unsupported'));
        }
    }

    private _listenDeviceOrientationAbsolute() {
        const subject = new Subject<
            PositionEventBearing | PositionEventDeviceOrientation
        >();
        let lastWebkitCompassBearing: number | null = null;
        let lastAlpha: number | null = null;
        let lastBeta: number | null = null;
        let lastGamma: number | null = null;
        const eventListener = (event: DeviceOrientationEvent) => {
            // Webkit doesn't use "alpha" correctly
            // https://stackoverflow.com/questions/16048514/can-i-use-javascript-to-get-the-compass-heading-for-ios-and-android/26275869#answer-27390389
            if (typeof (event as any).webkitCompassHeading === 'number') {
                // Note that "bearing" is the direction you are facing,
                // "heading" is the direction you are moving. In this case,
                // compasses only return bearing.
                if (
                    (event as any).webkitCompassHeading ===
                    lastWebkitCompassBearing
                ) {
                    return;
                }

                lastWebkitCompassBearing = (event as any).webkitCompassHeading;
                subject.next({
                    bearing: (event as any).webkitCompassHeading,
                });
            } else if (
                event.alpha === null ||
                event.beta === null ||
                event.gamma === null
            ) {
                subject.error(new Error('Unsupported'));
            } else if (
                lastAlpha !== event.alpha ||
                lastBeta !== event.beta ||
                lastGamma !== event.gamma
            ) {
                lastAlpha = event.alpha;
                lastBeta = event.beta;
                lastGamma = event.gamma;
                subject.next({
                    alpha: event.alpha,
                    beta: event.beta,
                    gamma: event.gamma,
                });
            }
        };
        const eventName = 'deviceorientationabsolute';
        this._observable = subject.asObservable().pipe(
            finalize(() => {
                window.removeEventListener(eventName, eventListener);
                this._observable = null;
            }),
            share({
                connector: () => new ReplaySubject(1),
                resetOnRefCountZero: true,
            })
        );
        window.addEventListener(eventName, eventListener);
    }
}
