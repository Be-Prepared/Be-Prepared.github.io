import { BehaviorSubject } from 'rxjs';
import { di } from 'fudgel';
import { DistanceSystem } from '../datatypes/distance-system';
import { PreferenceService } from './preference.service';

export interface DistanceOptions {
    useSmallUnits?: boolean;
    isSpeed?: boolean;
}

export const DISTANCE_SYSTEMS = [
    DistanceSystem.METRIC,
    DistanceSystem.IMPERIAL,
];

export const DistanceSystemDefault = DistanceSystem.IMPERIAL;

export class DistanceService {
    private _currentSetting = new BehaviorSubject<DistanceSystem>(
        DistanceSystemDefault,
    );
    private _preferenceService = di(PreferenceService);

    constructor() {
        if (this._preferenceService.distanceSystem.getItem() === DistanceSystem.METRIC) {
            this._currentSetting.next(DistanceSystem.METRIC);
        }
    }

    getCurrentSetting() {
        return this._currentSetting.asObservable();
    }

    metersToString(meters: number, options: DistanceOptions = {}): string {
        if (this._currentSetting.value === DistanceSystem.METRIC) {
            return this._toMetric(meters, options);
        }

        return this._toImperial(meters, options);
    }

    reset() {
        this._preferenceService.distanceSystem.reset();
        this._currentSetting.next(DistanceSystemDefault);
    }

    setDistanceSystem(value: DistanceSystem) {
        if (DISTANCE_SYSTEMS.includes(value)) {
            this._currentSetting.next(value);
            this._preferenceService.distanceSystem.setItem(value);
        }
    }

    private _fixed(n: number): string {
        const a = Math.abs(n);
        let digits = 0;

        if (a < 1) {
            digits = 3;
        } else if (a < 10) {
            digits = 2;
        } else if (a < 100) {
            digits = 1;
        }

        const factor = Math.pow(10, digits);
        const result = Math.round(n * factor) / factor;

        return result.toLocaleString();
    }

    private _toImperial(meters: number, options: DistanceOptions): string {
        const feet = meters * 3.2808398950131;

        if (options.isSpeed) {
            const mph = (feet * 3600) / 5280;

            return `${this._fixed(mph)} mph`;
        }

        if (feet < 528 || options.useSmallUnits) {
            return `${Math.round(feet)} ft`;
        }

        const miles = feet / 5280;

        return `${this._fixed(miles)} mi`;
    }

    private _toMetric(meters: number, options: DistanceOptions): string {
        if (options.isSpeed) {
            return `${this._fixed(3.6 * meters)} km/h`;
        }

        if (meters < 1000 || options.useSmallUnits) {
            return `${this._fixed(meters)} m`;
        }

        const kilometers = meters / 1000;

        return `${this._fixed(kilometers)} km`;
    }
}
