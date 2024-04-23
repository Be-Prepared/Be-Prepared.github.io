import { BehaviorSubject } from 'rxjs';

export interface DistanceOptions {
    useSmallUnits?: boolean;
    isSpeed?: boolean;
}

export enum DistanceSystem {
    IMPERIAL = 'imperial',
    METRIC = 'metric',
}

export const DistanceSystemDefault = DistanceSystem.IMPERIAL;

export class DistanceService {
    #currentSetting = new BehaviorSubject<DistanceSystem>(
        DistanceSystemDefault
    );

    constructor() {
        if (localStorage.getItem('distanceSystem') === DistanceSystem.METRIC) {
            this.#currentSetting.next(DistanceSystem.METRIC);
        }
    }

    getCurrentSetting() {
        return this.#currentSetting.asObservable();
    }

    metersToString(meters: number, options: DistanceOptions = {}): string {
        if (this.#currentSetting.value === DistanceSystem.METRIC) {
            return this.#toMetric(meters, options);
        }

        return this.#toImperial(meters, options);
    }

    toggleSystem() {
        const newValue =
            this.#currentSetting.value === DistanceSystem.METRIC
                ? DistanceSystem.IMPERIAL
                : DistanceSystem.METRIC;
        this.#currentSetting.next(newValue);
        localStorage.setItem('distanceSystem', newValue);
    }

    #fixed(n: number): string {
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

    #toImperial(meters: number, options: DistanceOptions): string {
        const feet = meters * 3.2808398950131;

        if (options.isSpeed) {
            const mph = (feet / 5280) * 3600;

            return `${this.#fixed(mph)} mph`;
        }

        if (feet < 528 || options.useSmallUnits) {
            return `${Math.round(feet)} ft`;
        }

        const miles = feet / 5280;

        return `${this.#fixed(miles)} mi`;
    }

    #toMetric(meters: number, options: DistanceOptions): string {
        if (options.isSpeed) {
            return `${this.#fixed(3600 * meters / 1000)} km/h`;
        }

        if (meters < 1000 || options.useSmallUnits) {
            return `${this.#fixed(meters)} m`;
        }

        const kilometers = meters / 1000;

        return `${this.#fixed(kilometers)} km`;
    }
}
