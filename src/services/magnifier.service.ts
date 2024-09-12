import { AvailabilityState } from '../datatypes/availability-state';
import { di } from '../di';
import { from, of } from 'rxjs';
import { PermissionsService } from './permissions.service';
import { PreferenceService } from './preference.service';
import { switchMap } from 'rxjs/operators';

export class MagnifierService {
    private _permissionsService = di(PermissionsService);
    private _preferenceService = di(PreferenceService);

    availabilityState(useLiveValue: boolean) {
        if (!navigator.mediaDevices) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        const whenGranted = () => {
            return from(
                this.getStream().then((stream) => {
                    const tracks = stream.getVideoTracks();

                    if (tracks.length) {
                        this._preferenceService.magnifier.setItem(true);

                        return AvailabilityState.ALLOWED;
                    }

                    this._preferenceService.magnifier.setItem(false);

                    return AvailabilityState.UNAVAILABLE;
                })
            );
        };

        return this._permissionsService.camera().pipe(
            switchMap((state) => {
                if (!useLiveValue) {
                    const cached = this._preferenceService.magnifier.getItem();

                    if (cached === true) {
                        return of(AvailabilityState.ALLOWED);
                    }

                    if (cached === false) {
                        return of(AvailabilityState.UNAVAILABLE);
                    }
                }

                return this._permissionsService.toAvailability(
                    state,
                    whenGranted
                );
            })
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
