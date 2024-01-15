import { AvailabilityState } from '../datatypes/availability-state';
import { di } from 'fudgel';
import { from, of } from 'rxjs';
import {
    PermissionsService,
    PermissionsServiceState
} from './permissions.service';
import { switchMap } from 'rxjs/operators';

export class MagnifierService {
    #permissionsService = di(PermissionsService);

    availabilityState() {
        if (!window.navigator.mediaDevices) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this.#permissionsService.camera().pipe(
            switchMap((state) => {
                if (state === PermissionsServiceState.ERROR) {
                    return of(AvailabilityState.ERROR);
                }

                if (state === PermissionsServiceState.PROMPT) {
                    return of(AvailabilityState.PROMPT);
                }

                if (state === PermissionsServiceState.DENIED) {
                    return of(AvailabilityState.DENIED);
                }

                return from(
                    this.getStream().then((stream) => {
                        const tracks = stream.getVideoTracks();

                        return !!tracks.length
                            ? AvailabilityState.GRANTED
                            : AvailabilityState.UNAVAILABLE;
                    })
                );
            })
        );
    }

    getStream() {
        return window.navigator.mediaDevices
            .getUserMedia({
                video: {
                    facingMode: 'environment',
                },
            });
    }
}
