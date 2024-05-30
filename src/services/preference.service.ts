import { CoordinateSystem } from '../datatypes/coordinate-system';
import { DistanceSystem } from '../datatypes/distance-system';
import {
    LocalStorageInterface,
    LocalStorageService,
} from './local-storage.service';
import { NavigationType } from '../datatypes/navigation-type';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { TimeSystem } from '../datatypes/time-system';

export class PreferenceService {
    barcodeReader: LocalStorageInterface<boolean>;
    coordinateSystem: LocalStorageInterface<CoordinateSystem>;
    distanceSystem: LocalStorageInterface<DistanceSystem>;
    // fields are not stored here
    magnifier: LocalStorageInterface<boolean>;
    navigationType: LocalStorageInterface<NavigationType>;
    points: LocalStorageInterface<WaypointSaved[]>;
    sunMoonLocation: LocalStorageInterface<string>;
    timeSystem: LocalStorageInterface<TimeSystem>;
    torch: LocalStorageInterface<boolean>;

    constructor() {
        // Clean up old preferences
        for (const name of ['barcodeReader']) {
            const x = LocalStorageService.string(name);
            x.reset();
        }

        this.barcodeReader = LocalStorageService.boolean('barcodeReader2');
        this.coordinateSystem = LocalStorageService.enum<CoordinateSystem>(
            'coordinateSystem',
            CoordinateSystem
        );
        this.distanceSystem = LocalStorageService.enum<DistanceSystem>(
            'distanceSystem',
            DistanceSystem
        );
        this.magnifier = LocalStorageService.boolean('magnifier');
        this.navigationType = LocalStorageService.enum<NavigationType>(
            'navigationType',
            NavigationType
        );
        this.points = LocalStorageService.json('points');
        this.sunMoonLocation = LocalStorageService.string('sunMoonLocation');
        this.timeSystem = LocalStorageService.enum<TimeSystem>(
            'time',
            TimeSystem
        );
        this.torch = LocalStorageService.boolean('torch');
    }

    field<T>(id: string, allowedValues: T[]): LocalStorageInterface<T> {
        return LocalStorageService.list(`field.${id}`, allowedValues);
    }
}
