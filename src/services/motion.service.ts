import { AccessState } from './access/access-controller';
import {
    gravityFromEuler,
    toScreenFrame,
    Vector3,
} from './motion/motion-math';
import { Observable, ReplaySubject } from 'rxjs';
import { share } from 'rxjs/operators';

export interface MotionUpdate {
    // Unit vector toward the ground in screen coordinates (x right, y up,
    // z out of the screen). Null until the first reading arrives.
    gravity: Vector3 | null;

    // Use with <access-screen>. READY once readings arrive.
    state: AccessState;

    // True when permission is fine but no readings are arriving, which iOS
    // Low Power Mode can cause.
    waiting: boolean;
}

const NO_DATA_PROMPT_MS = 1000;
const NO_DATA_WAITING_MS = 3000;
const NULL_GRACE_MS = 1000;

// Device tilt from DeviceOrientationEvent. Does not need the magnetometer,
// so it works on devices without a compass and is unaffected by magnets.
export class MotionService {
    private _observable: Observable<MotionUpdate> | null = null;
    private _onDenied: (() => void) | null = null;
    private _onGranted: (() => void) | null = null;

    isSupported() {
        return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    }

    // iOS needs a tap before it will share motion data. Call from a click
    // handler. Other browsers resolve true right away.
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
                    this._onGranted?.();
                } else {
                    this._onDenied?.();
                }

                return granted;
            });
    }

    watch(): Observable<MotionUpdate> {
        if (!this._observable) {
            this._observable = new Observable<MotionUpdate>((subscriber) => {
                const stop = this._start((update) => subscriber.next(update));

                return () => {
                    stop();
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

    private _start(emit: (update: MotionUpdate) => void) {
        let state = AccessState.CHECKING;
        let waiting = false;
        let gravity: Vector3 | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const send = () => emit({ gravity, state, waiting });
        const clearTimer = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };
        const startTimer = (ms: number, onTimeout: () => void) => {
            clearTimer();
            timer = setTimeout(() => {
                timer = null;

                if (!gravity) {
                    onTimeout();
                    send();
                }
            }, ms);
        };
        let unavailableTimer: ReturnType<typeof setTimeout> | null = null;
        const listener = (event: DeviceOrientationEvent) => {
            if (event.beta === null || event.gamma === null) {
                // Desktop browsers send empty readings because they have no
                // sensor. Some phones also send one while the sensor starts,
                // so give real readings a moment before giving up, and never
                // give up once real readings have arrived.
                if (!gravity && !unavailableTimer) {
                    unavailableTimer = setTimeout(() => {
                        if (!gravity) {
                            clearTimer();
                            state = AccessState.UNAVAILABLE;
                            send();
                        }
                    }, NULL_GRACE_MS);
                }

                return;
            }

            clearTimer();
            gravity = toScreenFrame(
                gravityFromEuler(event.beta, event.gamma),
                this._screenAngle()
            );
            state = AccessState.READY;
            waiting = false;
            send();
        };
        const listen = () => {
            window.removeEventListener('deviceorientation', listener);
            window.addEventListener('deviceorientation', listener);
        };
        const waitForData = () =>
            startTimer(NO_DATA_WAITING_MS, () => {
                state = AccessState.READY;
                waiting = true;
            });

        send();

        if (!this.isSupported()) {
            state = AccessState.UNAVAILABLE;
            send();

            return () => {};
        }

        listen();

        if ((window.DeviceOrientationEvent as any).requestPermission) {
            // iOS. Data flows on its own if permission was already granted
            // during this session; otherwise a tap is needed.
            startTimer(NO_DATA_PROMPT_MS, () => (state = AccessState.PROMPT));
            this._onGranted = () => {
                // Some iOS versions only deliver events to listeners added
                // after permission was granted.
                listen();
                state = AccessState.CHECKING;
                send();
                waitForData();
            };
            this._onDenied = () => {
                state = AccessState.DENIED;
                send();
            };
        } else {
            waitForData();
        }

        return () => {
            clearTimer();

            if (unavailableTimer) {
                clearTimeout(unavailableTimer);
            }

            window.removeEventListener('deviceorientation', listener);
            this._onGranted = null;
            this._onDenied = null;
        };
    }
}
