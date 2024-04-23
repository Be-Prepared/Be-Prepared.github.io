export interface WaypointSaved {
    id: number;
    lat: number;
    lon: number;
    name: string;
    created: number;
}

const LOCAL_STORAGE_KEY = 'points';

export class WaypointService {
    #maxId = 0;
    #points: WaypointSaved[] = [
        { id: 1, lat: 0, lon: 0, name: 'Home', created: Date.now() },
    ];

    constructor() {
        this.#load();
    }

    addPoint(point: WaypointSaved) {
        this.#maxId += 1;
        this.#points.push({
            ...point,
            id: this.#maxId,
        });
        this.#save();
    }

    deletePoint(id: number) {
        const index = this.#points.findIndex((point) => point.id === id);

        if (index === -1) {
            return;
        }

        this.#points.splice(index, 1);
        this.#save();
    }

    getPoint(id: number): WaypointSaved | null {
        return this.#points.find((point) => point.id === id) || null;
    }

    getPoints() {
        return this.#points;
    }

    #isValidPoint(point: any): boolean {
        if (typeof point !== 'object' || !point) {
            return false;
        }

        if (
            point.lat &&
            point.lon &&
            point.created &&
            typeof point.name === 'string'
        ) {
            return true;
        }

        return false;
    }

    #load() {
        const pointsJson = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (!pointsJson) {
            return;
        }

        let points = [];
        let maxId = 0;

        try {
            points = JSON.parse(pointsJson);
        } catch (ignore) {
            return;
        }

        if (
            Array.isArray(points) &&
            points.every((point) => this.#isValidPoint(point))
        ) {
            for (const point of points) {
                maxId = Math.max(maxId, point.id);
            }

            this.#points = points;
        }
    }

    #save() {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.#points));
    }
}
