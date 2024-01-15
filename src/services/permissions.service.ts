import { map, shareReplay } from 'rxjs/operators';
import { Observable, of, ReplaySubject } from 'rxjs';

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

        window.navigator.permissions
            .query({
                name: name as unknown as PermissionName,
            })
            .then(
                (result) => {
                    subject.next(result.state);
                    result.onchange = () => subject.next(result.state);
                },
                () => {
                    subject.next('denied');
                }
            );

        return this.#cache(name, observable);
    }
}
