import { BehaviorSubject } from 'rxjs';

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

    metersToString(meters: number): string {
        if (this.#currentSetting.value === DistanceSystem.METRIC) {
            return this.#toMetric(meters);
        }

        return this.#toImperial(meters);
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

        if (a < 1) {
            return n.toFixed(3);
        }

        if (a < 10) {
            return n.toFixed(2);
        }

        if (a < 100) {
            return n.toFixed(1);
        }

        return n.toFixed(0);
    }

    #toImperial(meters: number): string {
        const feet = meters * 3.2808398950131;

        if (feet < 528) {
            return `${Math.round(feet)} ft`;
        }

        const miles = feet / 5280;

        return `${this.#fixed(miles)} mi`;
    }

    #toMetric(meters: number): string {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }

        const kilometers = meters / 1000;

        return `${this.#fixed(kilometers)} km`;
    }
}
