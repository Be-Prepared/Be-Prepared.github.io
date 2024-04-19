const METRIC = 'metric';
const IMPERIAL = 'imperial';

export class DistanceService {
    #currentSetting = IMPERIAL;

    constructor() {
        if (localStorage.getItem('distanceSystem') === METRIC) {
            this.#currentSetting = METRIC;
        }
    }

    metersToString(meters: number): string {
        if (this.#currentSetting === METRIC) {
            return this.#toMetric(meters);
        }

        return this.#toImperial(meters);
    }

    toggleDistanceSystem() {
        this.#currentSetting = this.#currentSetting === METRIC ? IMPERIAL : METRIC;
        localStorage.setItem('distanceSystem', this.#currentSetting);
    }

    #toImperial(meters: number): string {
        const feet = meters * 3.2808398950131;

        if (feet < 528) {
            return `${Math.round(feet)}ft`;
        }

        const miles = feet / 5280;
        return `${miles.toFixed(2)}mi`;
    }

    #toMetric(meters: number): string {
        if (meters < 1000) {
            return `${Math.round(meters)}m`;
        }

        return `${(meters / 1000).toFixed(2)}km`;
    }
}
