import { di } from '../di';
import { PreferenceService } from '../services/preference.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';

// Checks numbers by type, not truthiness: a waypoint on the equator or the
// prime meridian has a coordinate of 0, and one bad point would otherwise
// throw away every saved waypoint.
export function isValidPoint(point: any): point is WaypointSaved {
    const finite = (n: any) => typeof n === 'number' && isFinite(n);

    return (
        typeof point === 'object' &&
        !!point &&
        finite(point.id) &&
        finite(point.lat) &&
        finite(point.lon) &&
        finite(point.created) &&
        typeof point.name === 'string'
    );
}

export class WaypointService {
    private _maxId = 0;
    private _points: WaypointSaved[] = [];
    private _preferenceService = di(PreferenceService);

    constructor() {
        this._load();
    }

    deletePoint(id: number) {
        const index = this._points.findIndex((point) => point.id === id);

        if (index === -1) {
            return;
        }

        this._points.splice(index, 1);
        this._save();
    }

    getPoint(id: number): WaypointSaved | null {
        const point = this._points.find((point) => point.id === id);

        if (!point) {
            return null;
        }

        return {
            ...point,
        };
    }

    getPoints() {
        return this._points;
    }

    newPoint(): WaypointSaved {
        this._maxId += 1;
        const point = {
            id: this._maxId,
            name: '',
            lat: 0,
            lon: 0,
            created: Date.now(),
        };
        this._points.push(point);
        this._save();

        return point;
    }

    updatePoint(point: WaypointSaved) {
        const index = this._points.findIndex((p) => p.id === point.id);

        if (index >= 0) {
            this._points.splice(index, 1);
        }

        this._points.push({ ...point });
        this._save();
    }


    private _load() {
        const points = this._preferenceService.points.getItem();
        let maxId = 0;

        if (
            Array.isArray(points) &&
            points.every(isValidPoint)
        ) {
            for (const point of points) {
                maxId = Math.max(maxId, point.id);
            }

            this._points = points;
        }

        this._maxId = maxId;
    }

    private _save() {
        this._preferenceService.points.setItem(this._points);
    }
}
