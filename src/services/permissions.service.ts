import { AvailabilityState } from '../datatypes/availability-state';
import {
    distinctUntilChanged,
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
    #observables = new Map<string, Observable<PermissionsServiceState>>();
    #subjects = new Map<
        string,
        ReplaySubject<null | PermissionsServiceState>
    >();

    camera(prompt = false) {
        if (!navigator.mediaDevices || !navigator.permissions) {
            return of(PermissionsServiceState.ERROR);
        }

        const name = 'camera' as PermissionName;
        const subject = this.#getSubject(name);

        if (prompt) {
            // Asking for `video: true` or `video: { facingMode: 'self' }` does
            // not work when viewing the app locally. Unsure about what happens
            // when deployed to HTTPS and if that changes.
            navigator.mediaDevices
                .getUserMedia({ video: { facingMode: 'environment' } })
                .then(
                    () => subject.next(PermissionsServiceState.GRANTED),
                    () => subject.next(PermissionsServiceState.DENIED)
                );
        }

        return this.#getPermission(name, subject);
    }

    geolocation(prompt = false) {
        if (!navigator.geolocation || !navigator.permissions) {
            return of(PermissionsServiceState.ERROR);
        }

        const name: PermissionName = 'geolocation';
        const subject = this.#getSubject(name);
        console.log('1getting geolocation', prompt);

        if (prompt) {
            navigator.geolocation.getCurrentPosition(
                () => {
                    console.log('1ok');
                    subject.next(PermissionsServiceState.GRANTED)},
                () => {console.log('1err'); subject.next(PermissionsServiceState.ERROR)},
                {
                    timeout: 4000,
                }
            );
        }

        return this.#getPermission(name, subject);
    }

    toAvailability(
        state: PermissionsServiceState,
        whenGranted: () => Observable<AvailabilityState>
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

        return whenGranted();
    }

    #checkPermission(name: PermissionName) {
        const subject = new ReplaySubject<PermissionState>(1);
        console.log('3check', name);

        navigator.permissions.query({ name }).then(
            (status) => {
                console.log('3status', status.state);
                subject.next(status.state);
                // Note: iOS has poor support for onchange.
                status.onchange = () => {
                    console.log('3onchange', status.state);
                    subject.next(status.state);
                };
            },
            () => subject.next('denied' as PermissionState)
        );

        return subject.asObservable();
    }

    #getPermission(
        name: PermissionName,
        subject: ReplaySubject<null | PermissionsServiceState>
    ): Observable<PermissionsServiceState> {
        let observable = this.#observables.get(name);

        if (observable) {
            console.log('2observable');
            return observable;
        }

        observable = subject.asObservable().pipe(
            switchMap((value) => {
                console.log('2value', value);
                if (value !== null) {
                    return of(value);
                }

                return this.#checkPermission(name).pipe(
                    map((state: PermissionState) => {
                        console.log('2state', state);
                        return this.#mapPermission(state);})
                );
            }),
            distinctUntilChanged(),
            shareReplay(1)
        );
        this.#observables.set(name, observable);

        return observable;
    }

    #getSubject(name: PermissionName) {
        let subject = this.#subjects.get(name);

        if (!subject) {
            subject = new ReplaySubject(1);
            subject.next(null);
            this.#subjects.set(name, subject);
        }

        return subject;
    }

    #mapPermission(state: PermissionState) {
        let mapped = PermissionsServiceState.DENIED;

        if (state === 'granted') {
            mapped = PermissionsServiceState.GRANTED;
        } else if (state === 'prompt') {
            mapped = PermissionsServiceState.PROMPT;
        }

        return mapped;
    }
}
