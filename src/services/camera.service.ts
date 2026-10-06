import {
    AccessController,
    AccessControllerConfig,
} from './access/access-controller';
import { watchPermission } from './access/permission-status';

const TORCH_OFF_TIMEOUT_MS = 500;

export interface CameraOptions {
    // "user" is the selfie camera. Defaults to the rear camera.
    facing?: 'environment' | 'user';
    // Ask for a high resolution stream. Useful for digital zoom.
    highResolution?: boolean;
    releaseWhenHidden?: boolean;
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

        const video: MediaTrackConstraints = {
            facingMode: options.facing || 'environment',
        };

        if (options.highResolution) {
            video.width = { ideal: 1920 };
            video.height = { ideal: 1080 };
        }

        return navigator.mediaDevices
            .getUserMedia({ audio: false, video })
            .then((stream) => {
                this._openStreams.add(stream);

                return stream;
            });
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
