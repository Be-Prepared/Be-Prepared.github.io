import { AvailabilityState } from '../datatypes/availability-state';
import { catchError, finalize, first, map, share } from 'rxjs/operators';
import { of, throwError } from 'rxjs';
import { Observable, ReplaySubject, Subject } from 'rxjs';

export type PositionEvent =
    | PositionEventHeading
    | PositionEventDeviceOrientation
    | PositionEventQuaternion;

export interface PositionEventHeading {
    heading: number;
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
    #observable: Observable<PositionEvent> | null = null;

    availabilityState() {
        if (
            !(
                'AbsoluteOrientationSensor' in window ||
                'ondeviceorientationabsolute' in window
            )
        ) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this.#checkAvailability();
    }

    getCompassHeading() {
        return this.getLocationEvents().pipe(
            map((event: PositionEvent) => {
                if ('alpha' in event) {
                    return this.#convertDeviceOrientationToHeading(event);
                }

                if ('quaternion' in event) {
                    return this.#convertQuaternionToHeading(event);
                }

                return event.heading;
            }),
            share({
                connector: () => new ReplaySubject(1),
                resetOnRefCountZero: true,
            })
        );
    }

    getLocationEvents() {
        if (!this.#observable) {
            if ('AbsoluteOrientationSensor' in window) {
                this.#listenAbsoluteOrientationSensor();
            } else {
                this.#listenDeviceOrientationAbsolute();
            }
        }

        return this.#observable!;
    }

    #checkAvailability() {
        return this.getLocationEvents().pipe(
            map(() => AvailabilityState.ALLOWED),
            catchError(() => of(AvailabilityState.UNAVAILABLE)),
            first()
        );
    }

    #convertDeviceOrientationToHeading(
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

        // Calculate compass heading
        let heading = Math.atan(rA / rB);

        // Convert from half unit circle to whole unit circle
        if (rB < 0) {
            heading += Math.PI;
        } else if (rA < 0) {
            heading += 2 * Math.PI;
        }

        // Convert radians to degrees
        heading *= 180 / Math.PI;

        return heading;
    }

    #convertQuaternionToHeading(event: PositionEventQuaternion): number {
        const q = event.quaternion;
        const alpha =
            Math.atan2(
                2 * q[0] * q[1] + 2 * q[2] * q[3],
                1 - 2 * q[1] * q[1] - 2 * q[2] * q[2]
            ) *
            (180 / Math.PI);
        const heading = alpha < 0 ? alpha + 360 : alpha;

        return heading;
    }

    #listenAbsoluteOrientationSensor() {
        try {
            const sensor = new AbsoluteOrientationSensor({
                frequency: 60,
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
            this.#observable = subject.asObservable().pipe(
                finalize(() => {
                    sensor.stop();
                    this.#observable = null;
                }),
                share({
                    connector: () => new ReplaySubject(1),
                    resetOnRefCountZero: true,
                })
            );
        } catch (ignore) {
            this.#observable = throwError(new Error('Unsupported'));
        }
    }

    #listenDeviceOrientationAbsolute() {
        const subject = new Subject<
            PositionEventHeading | PositionEventDeviceOrientation
        >();
        let lastWebkitCompassHeading: number | null = null;
        let lastAlpha: number | null = null;
        let lastBeta: number | null = null;
        let lastGamma: number | null = null;
        const eventListener = (event: DeviceOrientationEvent) => {
            // Webkit doesn't use "alpha" correctly
            // https://stackoverflow.com/questions/16048514/can-i-use-javascript-to-get-the-compass-heading-for-ios-and-android/26275869#answer-27390389
            if (typeof (event as any).webkitCompassHeading === 'number') {
                if (
                    (event as any).webkitCompassHeading ===
                    lastWebkitCompassHeading
                ) {
                    return;
                }

                lastWebkitCompassHeading = (event as any).webkitCompassHeading;
                subject.next({
                    heading: (event as any).webkitCompassHeading,
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
        this.#observable = subject.asObservable().pipe(
            finalize(() => {
                window.removeEventListener(eventName, eventListener);
                this.#observable = null;
            }),
            share({
                connector: () => new ReplaySubject(1),
                resetOnRefCountZero: true,
            })
        );
        window.addEventListener(eventName, eventListener);
    }
}
