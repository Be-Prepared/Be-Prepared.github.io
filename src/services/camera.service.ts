import {
    AccessController,
    AccessControllerConfig,
} from './access/access-controller';
import { camerasFacing, Facing, nextCamera } from './camera/camera-choice';
import { LocalStorageService } from './local-storage.service';
import { watchPermission } from './access/permission-status';

const TORCH_OFF_TIMEOUT_MS = 500;

// Which lens to use on each side of the phone, picked with the switch
// camera button. A preference, not a permission: if that camera is gone,
// the default is used again.
const preferredCamera = {
    environment: LocalStorageService.string('camera.environment'),
    user: LocalStorageService.string('camera.user'),
};

export interface CameraChoices {
    // How many cameras face this way.
    count: number;
    // Which of them is in use, counting from 0.
    index: number;
}

export interface CameraOptions {
    // "user" is the selfie camera. Defaults to the rear camera.
    facing?: 'environment' | 'user';
    // Ask for a high resolution stream. Useful for digital zoom.
    highResolution?: boolean;
    releaseWhenHidden?: boolean;
    // Open the lens picked with the switch camera button. Only for screens
    // that show the picture and have that button. Tools that just need the
    // light must keep the default camera, which is the one that has it.
    switchable?: boolean;
}

// Every camera stream goes through here so that streams are always stopped.
// A stream that is never stopped keeps the camera locked (and its indicator
// light on) until the browser tears down the page, and on some phones even
// after the app is swiped away.
export class CameraService {
    private _openStreams = new Set<MediaStream>();

    constructor() {
        if (typeof window !== 'undefined') {
            // Safety net. Anything still open when the page goes away is
            // stopped.
            window.addEventListener('pagehide', () => this.closeAll());
        }
    }

    // Stops the stream. If the camera has a torch, it is switched off first:
    // some phones leave the light on after the track is stopped, which means
    // the light stays on after leaving the magnifier or barcode reader.
    close(stream: MediaStream): Promise<void> {
        this._openStreams.delete(stream);

        return Promise.all(
            stream.getTracks().map((track) => {
                if (!hasTorch(track)) {
                    track.stop();

                    return Promise.resolve();
                }

                return new Promise<void>((resolve) => {
                    let done = false;
                    const stop = () => {
                        if (!done) {
                            done = true;
                            track.stop();
                            resolve();
                        }
                    };

                    // Don't hold the camera if the device never answers.
                    setTimeout(stop, TORCH_OFF_TIMEOUT_MS);
                    setTorch(track, false).then(stop, stop);
                });
            })
        ).then(() => {});
    }

    closeAll() {
        for (const stream of [...this._openStreams]) {
            this.close(stream);
        }
    }

    // Creates a controller for a screen that uses a camera. Call
    // init() when the screen opens and destroy() when it closes.
    controller(options: CameraOptions = {}) {
        const config: AccessControllerConfig<MediaStream> = {
            permission: watchPermission('camera'),
            acquire: () => this.open(options),
            release: (stream) => this.close(stream),
            releaseWhenHidden: options.releaseWhenHidden,
        };

        return new AccessController(config);
    }

    // Whether the device has a camera at all. This does not need permission
    // and does not turn on the camera. Before permission is granted, browsers
    // list cameras without names, which is fine for this.
    hasCamera(): Promise<boolean> {
        if (!this.isSupported()) {
            return Promise.resolve(false);
        }

        if (!navigator.mediaDevices.enumerateDevices) {
            return Promise.resolve(true);
        }

        return navigator.mediaDevices.enumerateDevices().then(
            (devices) => devices.some((device) => device.kind === 'videoinput'),
            () => true
        );
    }

    isSupported() {
        return (
            typeof navigator !== 'undefined' &&
            !!navigator.mediaDevices &&
            !!navigator.mediaDevices.getUserMedia
        );
    }

    open(options: CameraOptions = {}): Promise<MediaStream> {
        if (!this.isSupported()) {
            const error = new Error('Camera API is not supported');
            error.name = 'NotSupportedError';

            return Promise.reject(error);
        }

        const facing = options.facing || 'environment';
        const size: MediaTrackConstraints = options.highResolution
            ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
            : {};
        const get = (video: MediaTrackConstraints) =>
            navigator.mediaDevices.getUserMedia({ audio: false, video });
        const preferred = options.switchable ? preferredCamera[facing].getItem() : null;
        const byDefault = () => get({ ...size, facingMode: facing });
        const opening = preferred
            ? get({ ...size, deviceId: { exact: preferred } }).catch((error) => {
                  // The chosen camera is gone (ids change when site data
                  // is cleared). Anything else, such as a refusal, is real.
                  if (
                      error?.name !== 'OverconstrainedError' &&
                      error?.name !== 'NotFoundError'
                  ) {
                      throw error;
                  }

                  preferredCamera[facing].reset();

                  return byDefault();
              })
            : byDefault();

        return opening.then((stream) => {
            this._openStreams.add(stream);

            return stream;
        });
    }

    // The cameras that face the same way as the open one. Only meaningful
    // while a stream is open, because browsers hide camera names until then.
    choices(facing: Facing, stream: MediaStream | null): Promise<CameraChoices> {
        return this._ids(facing, stream).then(({ ids, current }) => ({
            count: ids.length,
            index: Math.max(0, ids.indexOf(current)),
        }));
    }

    // Remembers the next camera on this side as the one to open. The caller
    // reopens the camera. Resolves with the new position.
    chooseNext(facing: Facing, stream: MediaStream | null): Promise<CameraChoices> {
        return this._ids(facing, stream).then(({ ids, current }) => {
            const next = nextCamera(ids, current);

            if (next) {
                preferredCamera[facing].setItem(next);
            }

            return { count: ids.length, index: Math.max(0, ids.indexOf(next)) };
        });
    }

    private _ids(facing: Facing, stream: MediaStream | null) {
        const current = getVideoTrack(stream)?.getSettings?.().deviceId || '';

        if (!stream || !navigator.mediaDevices?.enumerateDevices) {
            return Promise.resolve({ ids: [] as string[], current });
        }

        return navigator.mediaDevices.enumerateDevices().then(
            (devices) => ({ ids: camerasFacing(devices, facing, current), current }),
            () => ({ ids: [] as string[], current })
        );
    }
}

export function getVideoTrack(stream: MediaStream | null | undefined) {
    return stream?.getVideoTracks()[0] || null;
}

// Torch (flashlight) helpers that work on an already-open camera track.
// Opening a second stream just to toggle the light is what used to leave the
// camera locked.
export function hasTorch(track: MediaStreamTrack | null) {
    if (!track || !track.getCapabilities) {
        return false;
    }

    const capabilities = track.getCapabilities() as any;

    if (capabilities.torch) {
        return true;
    }

    const fillLightMode = capabilities.fillLightMode;

    return (
        Array.isArray(fillLightMode) &&
        fillLightMode.some((mode: string) => mode !== 'off' && mode !== 'none')
    );
}

export function isTorchOn(track: MediaStreamTrack | null) {
    if (!track || !track.getSettings) {
        return false;
    }

    const settings = track.getSettings() as any;

    return !!settings.torch || settings.fillLightMode === 'flash';
}

export function setTorch(track: MediaStreamTrack | null, enabled: boolean) {
    if (!track) {
        return Promise.reject(new Error('No camera track'));
    }

    const capabilities = (track.getCapabilities?.() || {}) as any;
    const constraint: any = {};

    if (capabilities.torch) {
        constraint.torch = enabled;
    } else {
        constraint.fillLightMode = enabled ? 'flash' : 'off';
    }

    return track.applyConstraints({ advanced: [constraint] });
}
