import { AvailabilityState } from '../datatypes/availability-state';
import { combineLatest, Observable, ReplaySubject } from 'rxjs';
import { CompassAbsoluteOrientationSensor } from './compass/compass-absolute-orientation-sensor';
import { CompassDeviceOrientation } from './compass/compass-device-orientation';
import { CompassInterface } from './compass/compass-interface';
import { di } from 'fudgel';
import { map, shareReplay, switchMap } from 'rxjs/operators';

export class CompassService {
    private _absoluteOrientationSensor = di(CompassAbsoluteOrientationSensor);
    private _deviceOrientation = di(CompassDeviceOrientation);
    private _lastAvailabilityStateObservable: Observable<AvailabilityState> | null =
        null;
    private _preferred: CompassInterface = this._absoluteOrientationSensor;
    private _promptSubject = new ReplaySubject<boolean>(1);
    private _typeSubject = new ReplaySubject<string>(1);

    constructor() {
        this._promptSubject.next(false);
    }

    availabilityState() {
        if (this._lastAvailabilityStateObservable) {
            return this._lastAvailabilityStateObservable;
        }

        this._lastAvailabilityStateObservable = this._promptSubject
            .asObservable()
            .pipe(
                switchMap(() =>
                    combineLatest([
                        this._absoluteOrientationSensor.availabilityState(),
                        this._deviceOrientation.availabilityState(),
                    ])
                ),
                map(([absoluteOrientationSensor, deviceOrientation]) => {
                    for (const desiredState of [
                        AvailabilityState.ALLOWED,
                        AvailabilityState.PROMPT,
                        AvailabilityState.DENIED,
                        AvailabilityState.UNAVAILABLE,
                    ]) {
                        if (absoluteOrientationSensor === desiredState) {
                            this._setType(this._absoluteOrientationSensor);

                            return absoluteOrientationSensor;
                        }

                        if (deviceOrientation === desiredState) {
                            this._setType(this._deviceOrientation);

                            return deviceOrientation;
                        }
                    }

                    return AvailabilityState.ERROR;
                }),
                shareReplay(1)
            );

        return this._lastAvailabilityStateObservable;
    }

    getCompassBearing() {
        return this._preferred.getCompassBearing();
    }

    prompt() {
        combineLatest([
            this._absoluteOrientationSensor.prompt(),
            this._deviceOrientation.prompt(),
        ]).subscribe(() => {
            this._promptSubject.next(true);
        });
    }

    typeObservable() {
        return this._typeSubject.asObservable();
    }

    private _setType(preferred: CompassInterface) {
        this._preferred = preferred;
        this._typeSubject.next(preferred.type());
    }
}
