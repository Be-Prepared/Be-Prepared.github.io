import { AccessController } from '../services/access/access-controller';
import { classifySensorError } from './detector';
import { watchPermission } from '../services/access/permission-status';

// The parts of the Generic Sensor Magnetometer that are used here.
export interface MagnetometerLike extends EventTarget {
    x?: number | null;
    y?: number | null;
    z?: number | null;
    start(): void;
    stop(): void;
}

// Give up when a started sensor never reports. Some browsers expose the API
// on devices without the hardware.
const FIRST_READING_TIMEOUT = 5000;

function startSensor(): Promise<MagnetometerLike> {
    return new Promise((resolve, reject) => {
        const Constructor = (window as any).Magnetometer;

        if (!Constructor) {
            reject({ name: 'NotSupportedError' });

            return;
        }

        let sensor: MagnetometerLike;

        try {
            sensor = new Constructor({ frequency: 30 });
        } catch (error) {
            reject(error);

            return;
        }

        const cleanUp = () => {
            clearTimeout(timer);
            sensor.removeEventListener('reading', onReading);
            sensor.removeEventListener('error', onError);
        };
        const fail = (error: any) => {
            cleanUp();

            try {
                sensor.stop();
            } catch (_ignore) {}

            reject(error);
        };
        const onReading = () => {
            cleanUp();
            resolve(sensor);
        };
        const onError = (event: Event) => fail((event as any).error || event);
        const timer = setTimeout(
            () => fail({ name: 'NotReadableError' }),
            FIRST_READING_TIMEOUT
        );
        sensor.addEventListener('reading', onReading);
        sensor.addEventListener('error', onError);

        try {
            sensor.start();
        } catch (error) {
            fail(error);
        }
    });
}

// The sensor is resolved once it has produced a reading, so READY means
// numbers are flowing.
export function magnetometerController() {
    return new AccessController<MagnetometerLike>({
        permission: watchPermission('magnetometer'),
        acquire: startSensor,
        release: (sensor) => {
            try {
                sensor.stop();
            } catch (_ignore) {}
        },
        classifyError: classifySensorError,
    });
}
