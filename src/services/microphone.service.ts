import { AccessController } from './access/access-controller';
import { watchPermission } from './access/permission-status';

// Microphone access for measuring sound. Audio is analyzed live and never
// recorded or sent anywhere.
export class MicrophoneService {
    // Call init() when the screen opens and destroy() when it closes. The
    // microphone is released whenever the app is in the background.
    controller() {
        return new AccessController<MediaStream>({
            permission: watchPermission('microphone'),
            acquire: () => this.open(),
            release: (stream) => {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            },
        });
    }

    hasMicrophone(): Promise<boolean> {
        if (!this.isSupported()) {
            return Promise.resolve(false);
        }

        if (!navigator.mediaDevices.enumerateDevices) {
            return Promise.resolve(true);
        }

        return navigator.mediaDevices.enumerateDevices().then(
            (devices) => devices.some((device) => device.kind === 'audioinput'),
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

    open(): Promise<MediaStream> {
        if (!this.isSupported()) {
            const error = new Error('Microphone API is not supported');
            error.name = 'NotSupportedError';

            return Promise.reject(error);
        }

        // Browsers clean up voice audio by default. All of that changes the
        // level, so turn it off for measuring.
        return navigator.mediaDevices.getUserMedia({
            audio: {
                autoGainControl: false,
                echoCancellation: false,
                noiseSuppression: false,
            },
            video: false,
        });
    }
}
