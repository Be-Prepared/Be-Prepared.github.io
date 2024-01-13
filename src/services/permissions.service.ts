import { di } from 'fudgel';
import { from, Observable, of, Subject } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { TorchService } from './torch.service';

export const enum PermissionsServiceState {
    DENIED,
    ERROR,
    GRANTED,
    PROMPT,
    UNAVAILABLE,
}
export type PermissionsServiceName = 'camera' | 'torch';

export class PermissionsService {
    #cachedPermissions = new Map<string, Observable<PermissionsServiceState>>();
    #torchService = di(TorchService);

    camera() {
        return this.#getPermission('camera' as PermissionName);
    }

    torch() {
        if (!this.#torchService.browserSupport()) {
            return of(PermissionsServiceState.UNAVAILABLE);
        }

        return this.#getPermission('camera' as PermissionName).pipe(
            switchMap((state) => {
                if (state !== PermissionsServiceState.GRANTED) {
                    return of(state);
                }

                return from(this.#torchService.getVideoTrackWithTorch()).pipe(
                    map((track) => {
                        return !!track
                            ? PermissionsServiceState.GRANTED
                            : PermissionsServiceState.UNAVAILABLE;
                    })
                );
            })
        );
    }

    #getPermission(name: PermissionName): Observable<PermissionsServiceState> {
        const cached = this.#cachedPermissions.get(name);

        if (cached) {
            return cached;
        }

        const subject = new Subject<PermissionsServiceState>();
        const observable = subject.asObservable().pipe(shareReplay(1));
        this.#cachedPermissions.set(name, observable);

        window.navigator.permissions
            .query({
                name: name as unknown as PermissionName,
            })
            .then(
                (result) => {
                    const mapState = (state: PermissionState) => {
                        let mapped = PermissionsServiceState.DENIED;

                        if (state === 'granted') {
                            mapped = PermissionsServiceState.GRANTED;
                        } else if (state === 'prompt') {
                            mapped = PermissionsServiceState.PROMPT;
                        }

                        subject.next(mapped);
                    };
                    mapState(result.state);
                    result.onchange = () => mapState(result.state);
                },
                () => {
                    subject.next(PermissionsServiceState.DENIED);
                }
            );

        return observable;
    }
}
