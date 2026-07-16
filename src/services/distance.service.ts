import { BehaviorSubject } from 'rxjs';
import { di } from '../di';
import { DistanceSystem } from '../datatypes/distance-system';
import { PreferenceService } from './preference.service';

export interface DistanceOptions {
    floor?: boolean;
    isSpeed?: boolean;
    omitLabel?: boolean;
    useSmallUnits?: boolean;
    wholeNumber?: boolean;
}

export const DISTANCE_SYSTEMS = [
    DistanceSystem.METRIC,
    DistanceSystem.IMPERIAL,
];

export const DistanceSystemDefault = DistanceSystem.IMPERIAL;

export class DistanceService {
    private _currentSetting = new BehaviorSubject<DistanceSystem>(
        DistanceSystemDefault
    );
    private _preferenceService = di(PreferenceService);

    constructor() {
        if (
            this._preferenceService.distanceSystem.getItem() ===
            DistanceSystem.METRIC
        ) {
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

    toggleSystem() {
        const newValue =
            this._currentSetting.value === DistanceSystem.METRIC
                ? DistanceSystem.IMPERIAL
                : DistanceSystem.METRIC;
        this.setDistanceSystem(newValue);
    }

    private _fixed(n: number, options: DistanceOptions): string {
        const a = Math.abs(n);
        let digits = 0;

        if (a < 1) {
            digits = 3;
        } else if (a < 10) {
            digits = 2;
        } else if (a < 100) {
            digits = 1;
        }

        if (options.wholeNumber) {
            digits = 0;
        }

        const factor = Math.pow(10, digits);
        const scaled = n * factor;
        const visible = options.floor ? Math.floor(scaled) : Math.round(scaled);
        const result = visible / factor;

        return result.toLocaleString();
    }

    private _toImperial(meters: number, options: DistanceOptions): string {
        const feet = meters * 3.2808398950131;

        if (options.isSpeed) {
            const mph = (feet * 3600) / 5280;

            return this._withLabel(this._fixed(mph, options), 'mph', options);
        }

        if (feet < 528 || options.useSmallUnits) {
            return this._withLabel(Math.round(feet), 'ft', options);
        }

        const miles = feet / 5280;

        return this._withLabel(this._fixed(miles, options), 'mi', options);
    }

    private _toMetric(meters: number, options: DistanceOptions): string {
        if (options.isSpeed) {
            return this._withLabel(this._fixed(3.6 * meters, options), 'km/h', options);
        }

        if (meters < 1000 || options.useSmallUnits) {
            return this._withLabel(Math.round(meters), 'm', options);
        }

        const kilometers = meters / 1000;

        return this._withLabel(this._fixed(kilometers, options), 'km', options);
    }

    private _withLabel(value: string | number, label: string, options: DistanceOptions): string {
        if (options.omitLabel) {
            return `${value}`;
        }

        return `${value} ${label}`;
    }
}
