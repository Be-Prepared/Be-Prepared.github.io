import { CoordinateSystem } from '../datatypes/coordinate-system';
import { DistanceSystem } from '../datatypes/distance-system';
import {
    LocalStorageInterface,
    LocalStorageService,
} from './local-storage.service';
import { NavigationType } from '../datatypes/navigation-type';
import { WaypointSaved } from '../datatypes/waypoint-saved';

export class PreferenceService {
    barcodeReader: LocalStorageInterface<boolean>;
    coordinateSystem: LocalStorageInterface<CoordinateSystem>;
    distanceSystem: LocalStorageInterface<DistanceSystem>;
    // fields are not stored here
    magnifier: LocalStorageInterface<boolean>;
    navigationType: LocalStorageInterface<NavigationType>;
    points: LocalStorageInterface<WaypointSaved[]>;
    sunMoonLocation: LocalStorageInterface<string>;
    torch: LocalStorageInterface<boolean>;

    constructor() {
        this.barcodeReader = LocalStorageService.boolean('barcodeReader');
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
        this.torch = LocalStorageService.boolean('torch');
    }

    field<T>(
        id: string,
        allowedValues: T[]
    ): LocalStorageInterface<T> {
        return LocalStorageService.list(`field.${id}`, allowedValues);
    }
}
