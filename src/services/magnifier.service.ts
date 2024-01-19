import { AvailabilityState } from '../datatypes/availability-state';
import { di } from 'fudgel';
import { from, of } from 'rxjs';
import { PermissionsService } from './permissions.service';
import { switchMap } from 'rxjs/operators';

export class MagnifierService {
    #permissionsService = di(PermissionsService);

    availabilityState() {
        if (!navigator.mediaDevices) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        const whenGranted = () => {
            return from(
                this.getStream().then((stream) => {
                    const tracks = stream.getVideoTracks();

                    return !!tracks.length
                        ? AvailabilityState.ALLOWED
                        : AvailabilityState.UNAVAILABLE;
                })
            );
        };

        return this.#permissionsService
            .camera()
            .pipe(
                switchMap((state) =>
                    this.#permissionsService.toAvailability(state, whenGranted)
                )
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
        return this.#permissionsService.camera(true);
    }
}
