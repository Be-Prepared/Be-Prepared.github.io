import { AvailabilityState } from '../../datatypes/availability-state';
import { catchError, finalize, map, share, switchMap } from 'rxjs/operators';
import {
    combineLatest,
    Observable,
    of,
    ReplaySubject,
    Subject,
    throwError,
} from 'rxjs';
import { CompassInterface } from './compass-interface';
import { di } from 'fudgel';
import { PermissionsService } from '../permissions.service';

const RADIANS_TO_DEGREES = 180 / Math.PI;

export class CompassAbsoluteOrientationSensor implements CompassInterface {
    private _observable: Observable<number> | null = null;
    private _permissionsService = di(PermissionsService);

    availabilityState() {
        if (!(window as any).AbsoluteOrientationSensor) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this._permissions().pipe(
            map((results) => {
                return this._permissionsService.combineStates(results);
            }),
            switchMap((state) => {
                if (state === AvailabilityState.ALLOWED) {
                    return this.getCompassBearing().pipe(
                        map(() => AvailabilityState.ALLOWED),
                        catchError(() => of(AvailabilityState.ERROR))
                    );
                }

                return of(state);
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
        return this._permissions(true);
    }

    type() {
        return 'ABSOLUTE_ORIENTATION_SENSOR';
    }

    private _convertToCompassBearing(q: number[]) {
        const alpha =
            Math.atan2(
                2 * q[0] * q[1] + 2 * q[2] * q[3],
                1 - 2 * q[1] * q[1] - 2 * q[2] * q[2]
            ) * RADIANS_TO_DEGREES;
        const bearing = alpha < 0 ? alpha + 360 : alpha;

        return 360 - bearing;
    }

    private _observe() {
        try {
            const sensor = new AbsoluteOrientationSensor({
                frequency: 20,
                referenceFrame: 'screen',
            });
            const subject = new Subject<number>();
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
                    subject.next(
                        this._convertToCompassBearing(sensor.quaternion)
                    );
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

    private _permissions(prompt = false) {
        return combineLatest([
            this._permissionsService.accelerometer(prompt),
            this._permissionsService.gyroscope(prompt),
            this._permissionsService.magnetometer(prompt),
        ]);
    }
}
