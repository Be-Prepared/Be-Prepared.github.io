import { CameraService } from './services/camera.service';
import { CompassService } from './services/compass.service';
import { di } from './di';
import { GeolocationService } from './services/geolocation.service';
import { MicrophoneService } from './services/microphone.service';
import { NfcService } from './services/nfc.service';

export interface TileDef {
    id: string;
    icon: string;
    label: string;
    component: string;

    // Whether the device has the hardware for this tool. This must never ask
    // for permission or turn anything on; permissions are handled when the
    // tool is opened. A tool whose permission was denied still gets a tile so
    // it can be allowed again later.
    hasHardware: () => boolean | Promise<boolean>;
}

const hasCamera = () => di(CameraService).hasCamera();
const hasCompass = () => detectCompassHardware(di(CompassService));
const hasGeolocation = () => di(GeolocationService).isSupported();
const hasMicrophone = () => di(MicrophoneService).hasMicrophone();
const hasMotion = () => detectOrientationHardware();
const hasCameraAndMotion = () =>
    Promise.all([hasCamera(), hasMotion()]).then(([a, b]) => a && b);
const always = () => true;

// Desktop browsers define the APIs but have no sensors. Chrome reports this
// by firing one event with every angle set to null. iOS needs permission
// before sending any events, so it's assumed to have the sensors.
export function detectOrientationHardware(
    absolute = false,
    timeoutMs = 750
): Promise<boolean> {
    if (
        typeof window === 'undefined' ||
        !('DeviceOrientationEvent' in window)
    ) {
        return Promise.resolve(false);
    }

    if ((window.DeviceOrientationEvent as any).requestPermission) {
        return Promise.resolve(true);
    }

    return new Promise((resolve) => {
        const eventName =
            absolute && 'ondeviceorientationabsolute' in window
                ? 'deviceorientationabsolute'
                : 'deviceorientation';
        const done = (result: boolean) => {
            clearTimeout(timer);
            window.removeEventListener(eventName, listener);
            resolve(result);
        };
        const listener = (event: Event) => {
            const e = event as DeviceOrientationEvent;
            done((absolute ? e.alpha : e.beta) !== null);
        };
        // No event at all is inconclusive. Show the tile; the tool explains
        // if nothing arrives.
        const timer = setTimeout(() => done(true), timeoutMs);
        window.addEventListener(eventName, listener);
    });
}

export function detectCompassHardware(
    compassService: CompassService
): Promise<boolean> {
    if (!compassService.isSupported()) {
        return Promise.resolve(false);
    }

    // Desktop Chrome defines AbsoluteOrientationSensor too, so that alone
    // proves nothing. Events are what tell sensors apart.
    if (!('DeviceOrientationEvent' in window)) {
        return Promise.resolve(true);
    }

    return detectOrientationHardware(true);
}

export const tileDefs: TileDef[] = [
    {
        id: 'flashlight',
        icon: '/flashlight.svg',
        label: 'tile.flashlight',
        component: 'flashlight-app',
        hasHardware: hasCamera,
    },
    {
        id: 'frontLight',
        icon: '/front-light.svg',
        label: 'tile.frontLight',
        component: 'front-light-app',
        hasHardware: always,
    },
    {
        id: 'alarm',
        icon: '/alarm.svg',
        label: 'tile.alarm',
        component: 'alarm-app',
        hasHardware: always,
    },
    {
        id: 'alarm-clock',
        icon: '/alarm-clock.svg',
        label: 'tile.alarmClock',
        component: 'alarm-clock-app',
        hasHardware: always,
    },
    {
        id: 'magnifier',
        icon: '/magnifier.svg',
        label: 'tile.magnifier',
        component: 'magnifier-app',
        hasHardware: hasCamera,
    },
    {
        id: 'mirror',
        icon: '/mirror.svg',
        label: 'tile.mirror',
        component: 'mirror-app',
        hasHardware: hasCamera,
    },
    {
        id: 'compass',
        icon: '/compass.svg',
        label: 'tile.compass',
        component: 'compass-app',
        hasHardware: hasCompass,
    },
    {
        id: 'location',
        icon: '/location.svg',
        label: 'tile.location',
        component: 'location-app',
        hasHardware: hasGeolocation,
    },
    {
        id: 'pedometer',
        icon: '/pedometer.svg',
        label: 'tile.pedometer',
        component: 'pedometer-app',
        hasHardware: hasGeolocation,
    },
    {
        id: 'speed',
        icon: '/speed.svg',
        label: 'tile.speed',
        component: 'speed-app',
        hasHardware: hasGeolocation,
    },
    {
        id: 'level',
        icon: '/level.svg',
        label: 'tile.level',
        component: 'level-app',
        hasHardware: hasMotion,
    },
    {
        id: 'picture-hanging',
        icon: '/picture-hanging.svg',
        label: 'tile.pictureHanging',
        component: 'picture-hanging-app',
        hasHardware: hasCameraAndMotion,
    },
    {
        id: 'protractor',
        icon: '/protractor.svg',
        label: 'tile.protractor',
        component: 'protractor-app',
        // The camera is optional; it works over a plain background too.
        hasHardware: always,
    },
    {
        id: 'ruler',
        icon: '/ruler.svg',
        label: 'tile.ruler',
        component: 'ruler-app',
        hasHardware: always,
    },
    {
        id: 'barcode-reader',
        icon: '/barcode-reader.svg',
        label: 'tile.barcodeReader',
        component: 'barcode-reader-app',
        hasHardware: hasCamera,
    },
    {
        id: 'nfc',
        icon: '/nfc.svg',
        label: 'tile.nfc',
        component: 'nfc-app',
        hasHardware: () => di(NfcService).isSupported(),
    },
    {
        id: 'sound-level',
        icon: '/sound-level.svg',
        label: 'tile.soundLevel',
        component: 'sound-level-app',
        hasHardware: hasMicrophone,
    },
    {
        id: 'heart-rate',
        icon: '/heart-rate.svg',
        label: 'tile.heartRate',
        component: 'heart-rate-app',
        hasHardware: hasCamera,
    },
    {
        id: 'metal-detector',
        icon: '/metal-detector.svg',
        label: 'tile.metalDetector',
        component: 'metal-detector-app',
        // Only Chrome with the experimental sensors flag exposes this.
        hasHardware: () => 'Magnetometer' in window,
    },
    {
        id: 'timer',
        icon: '/timer.svg',
        label: 'tile.timer',
        component: 'timer-app',
        hasHardware: always,
    },
    {
        id: 'stopwatch',
        icon: '/stopwatch.svg',
        label: 'tile.stopwatch',
        component: 'stopwatch-app',
        hasHardware: always,
    },
    {
        id: 'sun-moon',
        icon: '/sun-moon.svg',
        label: 'tile.sunMoon',
        component: 'sun-moon-app',
        hasHardware: always,
    },
    {
        id: 'file-transfer',
        icon: '/file-transfer.svg',
        label: 'tile.fileTransfer',
        component: 'file-transfer-app',
        // Sending works without a camera; only receiving needs one.
        hasHardware: always,
    },
    {
        id: 'large-text',
        icon: '/large-text.svg',
        label: 'tile.largeText',
        component: 'large-text-app',
        hasHardware: always,
    },
    {
        id: 'info',
        icon: '/info.svg',
        label: 'tile.info',
        component: 'info-app',
        hasHardware: always,
    },
];
