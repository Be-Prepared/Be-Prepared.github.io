import {
    bearingFromEuler,
    bearingFromQuaternion,
    bearingFromWebkitHeading,
    normalize360,
} from './compass/compass-math';
import {
    CalibrationMonitor,
    CalibrationStatus,
} from './compass/calibration-monitor';
import { filter, map, share } from 'rxjs/operators';
import { Observable, ReplaySubject } from 'rxjs';

export const enum CompassState {
    // Sensors are starting up.
    STARTING = 'STARTING',

    // iOS: needs a tap on a button before permission can be requested.
    PROMPT = 'PROMPT',

    // Permission was refused.
    DENIED = 'DENIED',

    // No compass hardware.
    UNAVAILABLE = 'UNAVAILABLE',

    // Permission is fine but no readings are arriving. iOS Low Power Mode
    // causes this.
    WAITING = 'WAITING',

    // Readings are flowing.
    READY = 'READY',
}

export const enum CompassSource {
    NONE = 'NONE',
    ABSOLUTE_ORIENTATION_SENSOR = 'ABSOLUTE_ORIENTATION_SENSOR',
    DEVICE_ORIENTATION_ABSOLUTE = 'DEVICE_ORIENTATION_ABSOLUTE',
    DEVICE_ORIENTATION = 'DEVICE_ORIENTATION',
    WEBKIT_COMPASS_HEADING = 'WEBKIT_COMPASS_HEADING',
}

export interface CompassUpdate {
    // iOS accuracy in degrees, when known.
    accuracy: number | null;
    bearing: number;
    calibration: CalibrationStatus;
    source: CompassSource;
    state: CompassState;
}

// Time without any reading before the state changes to PROMPT (iOS) or
// WAITING (everything else).
const NO_DATA_PROMPT_MS = 1000;
const NO_DATA_WAITING_MS = 3000;

// Light smoothing to calm sensor jitter. 1 = no smoothing.
const SMOOTHING = 0.35;

interface Session {
    stop: () => void;
}

export class CompassService {
    private _observable: Observable<CompassUpdate> | null = null;
    private _permissionDenied: (() => void) | null = null;
    private _permissionGranted: (() => void) | null = null;

    // Whether the device appears to have any way to report direction. This
    // does not prompt for anything.
    isSupported() {
        return (
            'AbsoluteOrientationSensor' in window ||
            'DeviceOrientationEvent' in window
        );
    }

    getCompassBearing(): Observable<number> {
        return this.watch().pipe(
            filter((update) => update.state === CompassState.READY),
            map((update) => update.bearing)
        );
    }

    // iOS only. Must be called from a click handler.
    requestPermission(): Promise<boolean> {
        const DeviceOrientation = window.DeviceOrientationEvent as any;

        if (!DeviceOrientation?.requestPermission) {
            return Promise.resolve(true);
        }

        return DeviceOrientation.requestPermission()
            .then(
                (result: string) => result === 'granted',
                () => false
            )
            .then((granted: boolean) => {
                if (granted) {
                    this._permissionGranted?.();
                } else {
                    this._permissionDenied?.();
                }

                return granted;
            });
    }

    watch(): Observable<CompassUpdate> {
        if (!this._observable) {
            this._observable = new Observable<CompassUpdate>((subscriber) => {
                const session = this._start((update) =>
                    subscriber.next(update)
                );

                return () => {
                    session.stop();
                    this._observable = null;
                };
            }).pipe(
                share({
                    connector: () => new ReplaySubject(1),
                    resetOnRefCountZero: true,
                })
            );
        }

        return this._observable;
    }

    private _screenAngle() {
        const angle =
            window.screen?.orientation?.angle ??
            (window as any).orientation ??
            0;

        return typeof angle === 'number' ? angle : 0;
    }

    private _start(emit: (update: CompassUpdate) => void): Session {
        const monitor = new CalibrationMonitor();
        let accuracy: number | null = null;
        let bearing = NaN;
        let source = CompassSource.NONE;
        let state = CompassState.STARTING;
        let current: Session | null = null;
        let noDataTimer: ReturnType<typeof setTimeout> | null = null;
        let stopped = false;

        const send = () =>
            emit({
                accuracy,
                bearing,
                calibration: monitor.status(),
                source,
                state,
            });
        const setState = (newState: CompassState) => {
            if (newState !== state) {
                state = newState;
                send();
            }
        };
        const clearNoDataTimer = () => {
            if (noDataTimer) {
                clearTimeout(noDataTimer);
                noDataTimer = null;
            }
        };
        const startNoDataTimer = (ms: number, newState: CompassState) => {
            clearNoDataTimer();
            noDataTimer = setTimeout(() => {
                noDataTimer = null;

                if (state === CompassState.STARTING) {
                    setState(newState);
                }
            }, ms);
        };
        const reading = (
            newSource: CompassSource,
            newBearing: number,
            newAccuracy: number | null = null
        ) => {
            if (!isFinite(newBearing)) {
                return;
            }

            clearNoDataTimer();
            monitor.addAbsolute(Date.now(), newBearing);

            if (newAccuracy !== null) {
                monitor.addAccuracy(newAccuracy);
            }

            source = newSource;
            accuracy = newAccuracy;
            bearing = smooth(bearing, newBearing);
            state = CompassState.READY;
            send();
        };
        const relative = (relativeBearing: number) =>
            monitor.addRelative(relativeBearing);
        const unavailable = () => {
            clearNoDataTimer();
            setState(CompassState.UNAVAILABLE);
        };
        const startEvents = () => {
            if (stopped) {
                return;
            }

            current = this._startDeviceOrientation(reading, relative, unavailable);

            if ((window.DeviceOrientationEvent as any)?.requestPermission) {
                // iOS. If permission was already granted during this
                // session, events start flowing on their own. Otherwise a
                // button tap is needed.
                startNoDataTimer(NO_DATA_PROMPT_MS, CompassState.PROMPT);
                this._permissionGranted = () => {
                    // Some iOS versions only deliver events to listeners
                    // added after permission was granted.
                    current?.stop();
                    current = this._startDeviceOrientation(
                        reading,
                        relative,
                        unavailable
                    );
                    state = CompassState.STARTING;
                    send();
                    startNoDataTimer(
                        NO_DATA_WAITING_MS,
                        CompassState.WAITING
                    );
                };
                this._permissionDenied = () => setState(CompassState.DENIED);
            } else {
                startNoDataTimer(NO_DATA_WAITING_MS, CompassState.WAITING);
            }
        };

        send();

        if ('AbsoluteOrientationSensor' in window) {
            current = this._startOrientationSensor(
                (q) => reading(
                    CompassSource.ABSOLUTE_ORIENTATION_SENSOR,
                    bearingFromQuaternion(q)
                ),
                relative,
                (field) => monitor.addField(field[0], field[1], field[2]),
                () => {
                    // The sensor failed or is not permitted. Fall back to
                    // events, which use a different permission path.
                    current?.stop();
                    startEvents();
                }
            );
            startNoDataTimer(NO_DATA_WAITING_MS, CompassState.WAITING);
        } else if ('DeviceOrientationEvent' in window) {
            startEvents();
        } else {
            state = CompassState.UNAVAILABLE;
            send();
        }

        return {
            stop: () => {
                stopped = true;
                clearNoDataTimer();
                current?.stop();
                this._permissionGranted = null;
                this._permissionDenied = null;
            },
        };
    }

    private _startDeviceOrientation(
        reading: (
            source: CompassSource,
            bearing: number,
            accuracy?: number | null
        ) => void,
        relative: (bearing: number) => void,
        unavailable: () => void
    ): Session {
        const hasAbsoluteEvent = 'ondeviceorientationabsolute' in window;
        const absoluteListener = (event: DeviceOrientationEvent) => {
            if (
                event.alpha === null ||
                event.beta === null ||
                event.gamma === null
            ) {
                unavailable();

                return;
            }

            reading(
                CompassSource.DEVICE_ORIENTATION_ABSOLUTE,
                bearingFromEuler(
                    event.alpha,
                    event.beta,
                    event.gamma,
                    this._screenAngle()
                )
            );
        };
        const listener = (event: DeviceOrientationEvent) => {
            const webkitHeading = (event as any).webkitCompassHeading;
            const hasAngles =
                event.alpha !== null &&
                event.beta !== null &&
                event.gamma !== null;

            if (typeof webkitHeading === 'number') {
                // iOS. alpha is relative to wherever the device pointed when
                // the listener started, so it is used only as a gyroscope.
                const webkitAccuracy = (event as any).webkitCompassAccuracy;
                reading(
                    CompassSource.WEBKIT_COMPASS_HEADING,
                    bearingFromWebkitHeading(
                        webkitHeading,
                        this._screenAngle()
                    ),
                    typeof webkitAccuracy === 'number' ? webkitAccuracy : null
                );
            } else if (!hasAngles) {
                if (!hasAbsoluteEvent) {
                    unavailable();
                }

                return;
            } else if (!hasAbsoluteEvent && event.absolute) {
                // Firefox and others fire a single absolute event type.
                reading(
                    CompassSource.DEVICE_ORIENTATION,
                    bearingFromEuler(
                        event.alpha!,
                        event.beta!,
                        event.gamma!,
                        this._screenAngle()
                    )
                );

                return;
            } else if (!hasAbsoluteEvent) {
                // Only relative data and no other source. There is no way to
                // find north.
                unavailable();

                return;
            }

            if (hasAngles) {
                relative(
                    bearingFromEuler(
                        event.alpha!,
                        event.beta!,
                        event.gamma!,
                        this._screenAngle()
                    )
                );
            }
        };

        if (hasAbsoluteEvent) {
            window.addEventListener(
                'deviceorientationabsolute' as any,
                absoluteListener
            );
        }

        window.addEventListener('deviceorientation', listener);

        return {
            stop: () => {
                if (hasAbsoluteEvent) {
                    window.removeEventListener(
                        'deviceorientationabsolute' as any,
                        absoluteListener
                    );
                }

                window.removeEventListener('deviceorientation', listener);
            },
        };
    }

    private _startOrientationSensor(
        reading: (quaternion: ArrayLike<number>) => void,
        relative: (bearing: number) => void,
        field: (xyz: [number, number, number]) => void,
        failed: () => void
    ): Session {
        const sensors: { stop(): void }[] = [];
        let failedAlready = false;
        const fail = () => {
            if (!failedAlready) {
                failedAlready = true;
                failed();
            }
        };

        try {
            const absolute = new AbsoluteOrientationSensor({
                frequency: 30,
                referenceFrame: 'screen',
            });
            absolute.addEventListener('reading', () => {
                if (absolute.quaternion) {
                    reading(absolute.quaternion);
                }
            });
            absolute.addEventListener('error', fail);
            absolute.start();
            sensors.push(absolute);
        } catch (_ignore) {
            setTimeout(fail);
        }

        // Optional helpers for calibration detection. Failures are ignored.
        try {
            const RelativeSensor = (window as any).RelativeOrientationSensor;

            if (RelativeSensor) {
                const sensor = new RelativeSensor({
                    frequency: 30,
                    referenceFrame: 'screen',
                });
                sensor.addEventListener('reading', () => {
                    if (sensor.quaternion) {
                        relative(bearingFromQuaternion(sensor.quaternion));
                    }
                });
                sensor.start();
                sensors.push(sensor);
            }
        } catch (_ignore) {}

        try {
            const Magnetometer = (window as any).Magnetometer;

            if (Magnetometer) {
                const sensor = new Magnetometer({ frequency: 5 });
                sensor.addEventListener('reading', () => {
                    field([sensor.x, sensor.y, sensor.z]);
                });
                sensor.start();
                sensors.push(sensor);
            }
        } catch (_ignore) {}

        return {
            stop: () => {
                failedAlready = true;

                for (const sensor of sensors) {
                    try {
                        sensor.stop();
                    } catch (_ignore) {}
                }
            },
        };
    }
}

// Exponential smoothing that understands 359 and 1 are close together.
export function smooth(previous: number, next: number) {
    if (!isFinite(previous)) {
        return next;
    }

    let diff = normalize360(next - previous);

    if (diff > 180) {
        diff -= 360;
    }

    return normalize360(previous + diff * SMOOTHING);
}
