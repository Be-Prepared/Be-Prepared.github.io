import { AvailabilityState } from '../datatypes/availability-state';
import {
    distinctUntilChanged,
    first,
    map,
    shareReplay,
    switchMap,
} from 'rxjs/operators';
import { Observable, of, ReplaySubject } from 'rxjs';

export const enum PermissionsServiceState {
    ERROR = 'ERROR',
    DENIED = 'DENIED',
    PROMPT = 'PROMPT',
    GRANTED = 'GRANTED',
}
export type PermissionsServiceName = 'camera';

export class PermissionsService {
    private _observables = new Map<
        string,
        Observable<PermissionsServiceState>
    >();
    private _subjects = new Map<
        string,
        ReplaySubject<null | PermissionsServiceState>
    >();

    camera(prompt = false) {
        if (!navigator.mediaDevices || !navigator.permissions) {
            return of(PermissionsServiceState.ERROR);
        }

        const name = 'camera' as PermissionName;
        const subject = this._getSubject(name);

        if (prompt) {
            // Asking for `video: true` or `video: { facingMode: 'self' }` does
            // not work when viewing the app locally. Unsure about what happens
            // when deployed to HTTPS and if that changes.
            navigator.mediaDevices
                .getUserMedia({ video: { facingMode: 'environment' } })
                .then(
                    () => subject.next(PermissionsServiceState.GRANTED),
                    () => subject.next(PermissionsServiceState.DENIED),
                );
        }

        return this._getPermission(name, subject);
    }

    geolocation(prompt = false) {
        if (!navigator.geolocation || !navigator.permissions) {
            return of(PermissionsServiceState.ERROR);
        }

        const name: PermissionName = 'geolocation';
        const subject = this._getSubject(name);

        if (prompt) {
            navigator.geolocation.getCurrentPosition(
                () => {
                    subject.next(PermissionsServiceState.GRANTED);
                },
                () => {
                    subject.next(PermissionsServiceState.ERROR);
                },
                {
                    timeout: 4000,
                },
            );
        }

        return this._getPermission(name, subject);
    }

    nfc(prompt = false) {
        if (!(window as any).NDEFReader || !navigator.permissions) {
            return of(PermissionsServiceState.ERROR);
        }

        const name: PermissionName = 'nfc' as PermissionName;
        const subject = this._getSubject(name);

        if (prompt) {
            const abortController = new AbortController();
            const reader = new NDEFReader();
            reader.onreading = () => subject.next(PermissionsServiceState.GRANTED);
            reader.onreadingerror = () => subject.next(PermissionsServiceState.ERROR);
            reader.scan({
                signal: abortController.signal,
            }).then(() => {
                subject.next(PermissionsServiceState.GRANTED);
                abortController.abort();
            }, () => {
                subject.next(PermissionsServiceState.ERROR);
                abortController.abort();
            });
        }

        return this._getPermission(name, subject);
    }

    toAvailability(
        state: PermissionsServiceState,
        whenGranted?: () => Observable<AvailabilityState>,
    ) {
        if (state === PermissionsServiceState.ERROR) {
            return of(AvailabilityState.ERROR);
        }

        if (state === PermissionsServiceState.PROMPT) {
            return of(AvailabilityState.PROMPT);
        }

        if (state === PermissionsServiceState.DENIED) {
            return of(AvailabilityState.DENIED);
        }

        if (whenGranted) {
            return whenGranted();
        }

        return of(AvailabilityState.ALLOWED);
    }

    private _checkPermission(name: PermissionName) {
        const subject = new ReplaySubject<PermissionState>(1);

        navigator.permissions.query({ name }).then(
            (status) => {
                subject.next(status.state);
                // Note: iOS has poor support for onchange.
                status.onchange = () => {
                    subject.next(status.state);
                };
            },
            () => subject.next('denied' as PermissionState),
        );

        return subject.asObservable();
    }

    private _getPermission(
        name: PermissionName,
        subject: ReplaySubject<null | PermissionsServiceState>,
    ): Observable<PermissionsServiceState> {
        let observable = this._observables.get(name);

        if (observable) {
            return observable;
        }

        observable = subject.asObservable().pipe(
            switchMap((value) => {
                if (value !== null) {
                    return of(value);
                }

                return this._checkPermission(name).pipe(
                    map((state: PermissionState) => {
                        return this._mapPermission(state);
                    }),
                );
            }),
            distinctUntilChanged(),
            shareReplay(1),
        );
        this._observables.set(name, observable);

        return observable;
    }

    private _getSubject(name: PermissionName) {
        let subject = this._subjects.get(name);

        if (!subject) {
            subject = new ReplaySubject(1);
            subject.next(null);
            this._subjects.set(name, subject);
        }

        return subject;
    }

    private _mapPermission(state: PermissionState) {
        let mapped = PermissionsServiceState.DENIED;

        if (state === 'granted') {
            mapped = PermissionsServiceState.GRANTED;
        } else if (state === 'prompt') {
            mapped = PermissionsServiceState.PROMPT;
        }

        return mapped;
    }
}
