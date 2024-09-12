import { AvailabilityState } from '../datatypes/availability-state';
import { di } from '../di';
import { from, of } from 'rxjs';
import {
    PermissionsService,
    PermissionsServiceState,
} from './permissions.service';
import { PreferenceService } from './preference.service';
import { switchMap } from 'rxjs/operators';
import { ToastService } from './toast.service';

export class TorchService {
    private _currentlyActiveTrack: MediaStreamTrack | null = null;
    private _permissionsService = di(PermissionsService);
    private _preferenceService = di(PreferenceService);
    private _toastService = di(ToastService);

    availabilityState(useLiveValue: boolean) {
        if (!window.navigator.mediaDevices) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this._permissionsService.camera().pipe(
            switchMap((state) => {
                if (
                    state === PermissionsServiceState.ERROR ||
                    state === PermissionsServiceState.PROMPT ||
                    state === PermissionsServiceState.DENIED
                ) {
                    return this._permissionsService.toAvailability(state);
                }

                if (!useLiveValue) {
                    const cached = this._preferenceService.torch.getItem();

                    if (cached === true) {
                        return of(AvailabilityState.ALLOWED);
                    }

                    if (cached === false) {
                        return of(AvailabilityState.UNAVAILABLE);
                    }
                }

                return from(
                    this._getAllTracksWithTorch().then((tracks) => {
                        if (tracks.length) {
                            this._preferenceService.torch.setItem(true);

                            return AvailabilityState.ALLOWED;
                        }

                        this._preferenceService.torch.setItem(false);

                        return AvailabilityState.UNAVAILABLE;
                    })
                );
            })
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

    prompt() {
        this._permissionsService.camera(true).subscribe();
    }

    turnOff() {
        // Keep a reference to the track so garbage collection doesn't remove
        // it, thereby turning off the torch.
        if (this._currentlyActiveTrack) {
            this._currentlyActiveTrack = null;
        }

        return this._getAllTracksWithTorch()
            .then((tracks) => {
                const enabled = [];

                for (const track of tracks) {
                    if ((track.getSettings() as any).torch) {
                        enabled.push(track);
                    }
                }

                if (!enabled.length) {
                    return Promise.reject();
                }

                return Promise.all(
                    enabled.map((track) => this._setTorch(track, false))
                );
            })
            .then(() => this.currentStatus())
            .then((enabled) => {
                // Some devices just don't turn off the flash when asked.
                // Seems to be a problem with a paticular brand. If a
                // workaround is found, that would be preferred to reloading
                // the app.
                if (enabled) {
                    this._toastService.popI18n('service.torch.deviceIssue');
                    window.location.reload();
                }
            });
    }

    turnOn() {
        return this._getAllTracksWithTorch().then((tracks) => {
            if (tracks.length) {
                this._currentlyActiveTrack = tracks[0];

                return this._setTorch(tracks[0], true);
            }

            return Promise.reject();
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
                    const capabilities = track.getCapabilities() as any;

                    if (capabilities.torch) {
                        return true;
                    }

                    const fillLightMode = capabilities.fillLightMode;

                    if (
                        fillLightMode &&
                        fillLightMode.length > 0 &&
                        fillLightMode !== 'none'
                    ) {
                        return true;
                    }

                    return false;
                })
            );
    }

    private _setTorch(track: MediaStreamTrack, enabled: boolean) {
        return track.applyConstraints({
            advanced: [
                {
                    fillLightMode: enabled ? 'flash' : 'off',
                    torch: enabled,
                } as any,
            ],
        });
    }
}
