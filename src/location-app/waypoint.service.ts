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

    deletePoint(id: number) {
        const index = this.#points.findIndex((point) => point.id === id);

        if (index === -1) {
            return;
        }

        this.#points.splice(index, 1);
        this.#save();
    }

    getPoint(id: number): WaypointSaved | null {
        const point = this.#points.find((point) => point.id === id);

        if (!point) {
            return null;
        }

        return {
            ...point,
        };
    }

    getPoints() {
        return this.#points;
    }

    newPoint(): WaypointSaved {
        this.#maxId += 1;
        const point = {
            id: this.#maxId,
            name: '',
            lat: 0,
            lon: 0,
            created: Date.now(),
        };
        this.#points.push(point);
        this.#save();

        return point;
    }

    updatePoint(point: WaypointSaved) {
        const index = this.#points.findIndex((p) => p.id === point.id);

        if (index >= 0) {
            this.#points.splice(index, 1);
        }

        this.#points.push({ ...point });
        this.#save();
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
