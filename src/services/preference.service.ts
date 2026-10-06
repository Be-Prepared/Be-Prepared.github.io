import { BarcodeEngine } from './barcode-reader/engine-selection';
import { CoordinateSystem } from '../datatypes/coordinate-system';
import { DistanceSystem } from '../datatypes/distance-system';
import {
    LocalStorageInterface,
    LocalStorageService,
    storage,
} from './local-storage.service';
import { NavigationType } from '../datatypes/navigation-type';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { TimeSystem } from '../datatypes/time-system';

export class PreferenceService {
    barcodeEngine: LocalStorageInterface<BarcodeEngine>;
    coordinateSystem: LocalStorageInterface<CoordinateSystem>;
    distanceSystem: LocalStorageInterface<DistanceSystem>;
    // fields are not stored here
    navigationType: LocalStorageInterface<NavigationType>;
    navigationWakeLock: LocalStorageInterface<boolean>;
    points: LocalStorageInterface<WaypointSaved[]>;
    sunMoonLocation: LocalStorageInterface<string>;
    timeSystem: LocalStorageInterface<TimeSystem>;

    constructor() {
        // 2024-08-24 Clean up old preferences
        // Remove after at least one year
        for (const name of ['barcodeReader']) {
            const x = LocalStorageService.string(name);
            x.reset();
        }

        // 2024-08-24 Migrate old style preferences if needed
        // Remove all migration code after at least one year
        const preferenceVersion =
            LocalStorageService.number('preferenceVersion');

        if (preferenceVersion.getItem() !== 1) {
            this._migratePreferences();
            preferenceVersion.setItem(1);
        }

        // 2026-10-05 Hardware and permission results used to be cached,
        // which meant a denied permission or a failed probe hid a tool
        // forever. Nothing is cached any more; remove the old values.
        // Remove after at least one year
        for (const name of ['barcodeReader', 'magnifier', 'nfc', 'torch']) {
            storage.removeItem(name);
        }

        // Not "barcodeReader"; that key held an old cached probe result
        // and is removed above.
        this.barcodeEngine = LocalStorageService.enum<BarcodeEngine>(
            'barcodeEngine',
            BarcodeEngine
        );
        this.coordinateSystem = LocalStorageService.enum<CoordinateSystem>(
            'coordinateSystem',
            CoordinateSystem
        );
        this.distanceSystem = LocalStorageService.enum<DistanceSystem>(
            'distanceSystem',
            DistanceSystem
        );
        this.navigationType = LocalStorageService.enum<NavigationType>(
            'navigationType',
            NavigationType
        );
        this.navigationWakeLock =
            LocalStorageService.boolean('navigationWakeLock');
        this.points = LocalStorageService.json('points', 1, (value) => {
            return Array.isArray(value) && value.every((item) => {
                return typeof item === 'object' && item && 'lat' in item && 'lon' in item;
            });
        });
        this.sunMoonLocation = LocalStorageService.string('sunMoonLocation');
        this.timeSystem = LocalStorageService.enum<TimeSystem>(
            'time',
            TimeSystem
        );
    }

    field<T>(id: string, allowedValues: T[]): LocalStorageInterface<T> {
        return LocalStorageService.list(`field.${id}`, allowedValues);
    }

    _migratePreferences() {
        this._migrateJson('barcodeReader2', 'barcodeReader');
        this._migrateString('coordinateSystem');
        this._migrateString('distanceSystem');
        this._migrateJson('magnifier');
        this._migrateString('navigationType');
        this._migrateJson('navigationWakeLock');
        this._migrateJson('nfc');
        this._migrateJson('points');
        this._migrateString('sunMoonLocation');
        this._migrateString('time');
        this._migrateJson('torch');
    }

    _migrateJson(key: string, newKey?: string) {
        let old = storage.getItem(key);

        if (old) {
            this._setItem(newKey || key, `[1,${old}]`);
        }
    }

    _migrateString(key: string) {
        let old = storage.getItem(key);

        if (old) {
            this._setItem(key, JSON.stringify([1, old]));
        }
    }

    _setItem(key: string, value: string) {
        try {
            storage.setItem(key, value);
        } catch (e) {
            // Catch and fix error by clearing preferences
            storage.clear();
        }
    }
}
