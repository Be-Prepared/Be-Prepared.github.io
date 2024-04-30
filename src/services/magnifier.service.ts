import { AvailabilityState } from '../datatypes/availability-state';
import { di } from 'fudgel';
import { from, of } from 'rxjs';
import { PermissionsService } from './permissions.service';
import { switchMap } from 'rxjs/operators';

export class MagnifierService {
    private _permissionsService = di(PermissionsService);

    availabilityState(useLiveValue: boolean) {
        if (!navigator.mediaDevices) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        const whenGranted = () => {
            return from(
                this.getStream().then((stream) => {
                    const tracks = stream.getVideoTracks();

                    if (tracks.length) {
                        localStorage.setItem('magnifier', 'true');

                        return AvailabilityState.ALLOWED;
                    }

                    localStorage.setItem('magnifier', 'false');

                    return AvailabilityState.UNAVAILABLE;
                }),
            );
        };

        return this._permissionsService.camera().pipe(
            switchMap((state) => {
                if (!useLiveValue) {
                    const cached = localStorage.getItem('magnifier');

                    if (cached === 'true') {
                        return of(AvailabilityState.ALLOWED);
                    }

                    if (cached === 'false') {
                        return of(AvailabilityState.UNAVAILABLE);
                    }
                }

                return this._permissionsService.toAvailability(
                    state,
                    whenGranted,
                );
            }),
        );
    }

    getStream() {
        return navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
            },
        });
    }

    prompt() {
        return this._permissionsService.camera(true);
    }
}
