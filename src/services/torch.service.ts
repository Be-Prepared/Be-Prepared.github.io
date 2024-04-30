import { AvailabilityState } from '../datatypes/availability-state';
import { di } from 'fudgel';
import { from, of } from 'rxjs';
import {
    PermissionsService,
    PermissionsServiceState,
} from './permissions.service';
import { switchMap } from 'rxjs/operators';

export class TorchService {
    private _permissionsService = di(PermissionsService);

    availabilityState(useLiveValue: boolean) {
        if (!window.navigator.mediaDevices) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this._permissionsService.camera().pipe(
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

                if (!useLiveValue) {
                    const cached = localStorage.getItem('torch');

                    if (cached === 'true') {
                        return of(AvailabilityState.ALLOWED);
                    }

                    if (cached === 'false') {
                        return of(AvailabilityState.UNAVAILABLE);
                    }
                }

                return from(
                    this._getAllTracksWithTorch().then((tracks) => {
                        if (tracks.length) {
                            localStorage.setItem('torch', 'true');

                            return AvailabilityState.ALLOWED;
                        }

                        localStorage.setItem('torch', 'false');

                        return AvailabilityState.UNAVAILABLE;
                    }),
                );
            }),
        );
    }

    currentStatus() {
        return this._getAllTracksWithTorch().then((tracks) => {
            let enabled = false;

            for (const track of tracks) {
                if ((track.getSettings() as any).torch) {
                    enabled = true;
                }
            }

            return enabled;
        });
    }

    turnOff() {
        return this._getAllTracksWithTorch().then((tracks) => {
            const enabled = [];

            for (const track of tracks) {
                if ((track.getSettings() as any).torch) {
                    enabled.push(track);
                }
            }

            for (const track of enabled) {
                this._setTorch(track, false);
            }
        });
    }

    turnOn() {
        return this._getAllTracksWithTorch().then((tracks) => {
            if (tracks.length) {
                this._setTorch(tracks[0], true);
            }
        });
    }

    private _getAllTracksWithTorch() {
        return window.navigator.mediaDevices
            .getUserMedia({
                video: {
                    facingMode: 'environment',
                },
            })
            .then((stream) =>
                stream.getVideoTracks().filter((track) => {
                    return (track.getCapabilities() as any).torch;
                }),
            );
    }

    private _setTorch(track: MediaStreamTrack, enabled: boolean) {
        track.applyConstraints({
            advanced: [{ torch: enabled } as any],
        });
    }
}
