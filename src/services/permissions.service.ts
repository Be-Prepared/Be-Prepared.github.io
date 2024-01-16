import { map, shareReplay } from 'rxjs/operators';
import { Observable, of, ReplaySubject, Subject } from 'rxjs';

export const enum PermissionsServiceState {
    ERROR = 'ERROR',
    DENIED = 'DENIED',
    PROMPT = 'PROMPT',
    GRANTED = 'GRANTED',
}
export type PermissionsServiceName = 'camera';

export class PermissionsService {
    #cachedPermissions = new Map<string, Observable<PermissionsServiceState>>();

    camera() {
        return this.#getPermission('camera' as PermissionName);
    }

    #cache(
        name: PermissionName,
        observable: Observable<PermissionsServiceState>
    ) {
        this.#cachedPermissions.set(name, observable);

        return observable;
    }

    #getPermission(name: PermissionName): Observable<PermissionsServiceState> {
        const cached = this.#cachedPermissions.get(name);

        if (cached) {
            return cached;
        }

        if (!window.navigator.permissions) {
            return this.#cache(name, of(PermissionsServiceState.ERROR));
        }

        const subject = new ReplaySubject<PermissionState>(1);
        const observable = subject.asObservable().pipe(
            map((state: PermissionState) => {
                let mapped = PermissionsServiceState.DENIED;

                if (state === 'granted') {
                    mapped = PermissionsServiceState.GRANTED;
                } else if (state === 'prompt') {
                    mapped = PermissionsServiceState.PROMPT;
                }

                return mapped;
            }),
            shareReplay(1)
        );

        this.#checkPermission(name).then(
                (result) => {
                    subject.next(result.state);

                    result.onchange = () => {
                        subject.next(result.state);
                    };

                    // iOS does not use onChange, so we also need to poll.
                    this.#pollPermission(name, result, subject);
                }
            );

        return this.#cache(name, observable);
    }

    #checkPermission(name: PermissionName) {
        return window.navigator.permissions.query({name}).catch(() => {
            return {
                state: 'denied'
            } as PermissionStatus;
        });
    }

    #pollPermission(name: PermissionName, result: PermissionStatus, subject: Subject<PermissionState>) {
        setTimeout(() => {
            if (result.state === 'prompt') {
                this.#checkPermission(name).then((pollResult) => {
                    if (pollResult.state !== result.state) {
                        subject.next(pollResult.state);
                    }

                    this.#pollPermission(name, result, subject);
                });
            }
        }, 250);
    }
}
