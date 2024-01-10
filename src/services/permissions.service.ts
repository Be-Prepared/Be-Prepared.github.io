import { Observable, Subject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

export type PermissionsServiceName = 'camera';

export class PermissionsService {
    #cachedPermissions = new Map<string, Observable<PermissionState>>();

    camera() {
        return this.#getPermission('camera' as PermissionName);
    }

    #getPermission(name: PermissionName): Observable<PermissionState> {
        const cached = this.#cachedPermissions.get(name);

        if (cached) {
            return cached;
        }

        const subject = new Subject<PermissionState>();
        const observable = subject.asObservable().pipe(shareReplay(1));
        this.#cachedPermissions.set(name, observable);

        window.navigator.permissions.query({
            name: name as unknown as PermissionName
        }).then((result) => {
            subject.next(result.state);
            result.onchange = () => {
                subject.next(result.state);
            };
        }, () => {
            subject.next('denied')
        });

        return observable;
    }
}
