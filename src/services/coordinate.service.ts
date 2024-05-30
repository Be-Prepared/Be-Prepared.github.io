import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import CheapRuler from 'cheap-ruler';
import { CitiesService } from './cities.service';
import { Converter } from 'usng.js';
import { CoordinateSystem } from '../datatypes/coordinate-system';
import { di } from 'fudgel/dist/di';
import { DirectionService } from './direction.service';
import { LatLon } from '../datatypes/lat-lon';
import { map } from 'rxjs/operators';
import { PreferenceService } from './preference.service';

// By default, usng uses NAD83 but doesn't support WGS84. This is a workaround.
const converter = new (Converter as any)();
converter.ECC_SQUARED = 0.00669437999014;
converter.ECC_PRIME_SQUARED =
    converter.ECC_SQUARED / (1 - converter.ECC_SQUARED);
converter.E1 =
    (1 - Math.sqrt(1 - converter.ECC_SQUARED)) /
    (1 + Math.sqrt(1 - converter.ECC_SQUARED));

export const CoordinateSystemDefault = CoordinateSystem.DMS;

export const COORDINATE_SYSTEMS = [
    CoordinateSystem.DMS,
    CoordinateSystem.DDM,
    CoordinateSystem.DDD,
    CoordinateSystem.UTMUPS,
    CoordinateSystem.MGRS,
];

export interface NearestCity {
    name: string;
    lat: number;
    lon: number;
    distance: number;
    bearing: number;
}

export interface LL {
    lat: string;
    lon: string;
    latLon: string;
}

export interface MGRS {
    zone: string;
    square: string;
    easting: string;
    northing: string;
    mgrs: string;
}

export interface UTMUPS {
    zone: string;
    easting: string;
    northing: string;
    utmups: string;
}

export type SystemCoordinates = LL | MGRS | UTMUPS;

export class CoordinateService {
    private _cheapRulerCache = new Map<string, CheapRuler>();
    private _citiesService = di(CitiesService);
    private _currentSetting = new BehaviorSubject<CoordinateSystem>(
        CoordinateSystemDefault
    );
    private _directionService = di(DirectionService);
    private _preferencesService = di(PreferenceService);

    constructor() {
        const storedSetting =
            this._preferencesService.coordinateSystem.getItem();

        if (storedSetting) {
            this._currentSetting.next(storedSetting as CoordinateSystem);
        }
    }

    // Get the bearing between two points.
    // Builds the CheapRuler instance from the first LatLon unless useSecond is true.
    bearing(latLonFrom: LatLon, latLonTo: LatLon, useSecond = false): number {
        const cheapRuler = this._cheapRuler(
            useSecond ? latLonTo.lat : latLonFrom.lat
        );

        // Calculates the heading, not the bearing.
        const bearingToDestination = this._directionService.standardize360(
            cheapRuler.bearing(
                [latLonFrom.lon, latLonFrom.lat],
                [latLonTo.lon, latLonTo.lat]
            )
        );

        return bearingToDestination;
    }

    // Distance between two points
    // Builds the CheapRuler instance from the first LatLon.
    distance(latLon1: LatLon, latLon2: LatLon): number {
        const cheapRuler = this._cheapRuler(latLon1.lat);
        const distance = cheapRuler.distance(
            [latLon1.lon, latLon1.lat],
            [latLon2.lon, latLon2.lat]
        );

        return distance;
    }

    fromString(str: string): Observable<LatLon | null> {
        str = str.trim();

        return forkJoin([
            this._fromStringDegrees(str),
            this._fromStringMgrs(str),
            this._fromStringUtmUps(str),
            this._fromStringCity(str),
        ]).pipe(
            map(([degrees, mgrs, utmUps, city]) => {
                return degrees || mgrs || utmUps || city;
            })
        );
    }

    getCurrentSetting() {
        return this._currentSetting.asObservable();
    }

    getNearestCityByCoords(lat: number, lon: number) {
        return this._citiesService.getCitiesObservable().pipe(
            map((cities) => {
                let closest = null;
                let closestDistance = Infinity;

                for (const city of cities) {
                    const distance = this.distance({ lat, lon }, city);

                    if (distance < closestDistance) {
                        closest = city;
                        closestDistance = distance;
                    }
                }

                if (!closest) {
                    return {
                        name: '',
                        ascii: null,
                        lat: NaN,
                        lon: NaN,
                        distance: closestDistance,
                        bearing: NaN,
                    };
                }

                const bearing = this.bearing({ lat, lon }, closest);

                return {
                    ...closest,
                    distance: closestDistance,
                    bearing,
                };
            })
        );
    }

    latLonToSystem(lat: number, lon: number): SystemCoordinates {
        const currentSetting = this._currentSetting.value;

        if (currentSetting === CoordinateSystem.DMS) {
            return this._toDMS(lat, lon);
        }

        if (currentSetting === CoordinateSystem.DDM) {
            return this._toDDM(lat, lon);
        }

        if (currentSetting === CoordinateSystem.DDD) {
            return this._toDDD(lat, lon);
        }

        if (currentSetting === CoordinateSystem.UTMUPS) {
            return this._toUTMUPS(lat, lon);
        }

        return this._toMGRS(lat, lon);
    }

    latLonToSystemString(lat: number, lon: number): string {
        const system = this.latLonToSystem(lat, lon);

        if ('lat' in system) {
            return `${system.lat} ${system.lon}`;
        }

        if ('mgrs' in system) {
            return system.mgrs;
        }

        return system.utmups;
    }

    reset() {
        this._preferencesService.coordinateSystem.reset();
        this._currentSetting.next(CoordinateSystemDefault);
    }

    setCoordinateSystem(system: CoordinateSystem) {
        if (COORDINATE_SYSTEMS.includes(system as CoordinateSystem)) {
            this._currentSetting.next(system as CoordinateSystem);
            this._preferencesService.coordinateSystem.setItem(system);
        }
    }

    standardizeCoordinates(latLon: LatLon): LatLon {
        return {
            lat: this._directionService.standardizeLatitude(latLon.lat),
            lon: this._directionService.standardize180(latLon.lon),
        };
    }

    private _breakIntoCoordinateChunks(
        cleansed: string
    ): [string, string] | null {
        const coordinates = cleansed
            .split(/[ENSW]/)
            .map((item) => item.trim())
            .filter((item) => item !== '');

        if (coordinates.length > 1) {
            return [coordinates[0], coordinates[1]];
        }

        const x = coordinates.pop();

        if (!x) {
            return null;
        }

        const digitStrings = x.split(/ /);

        if (digitStrings.length % 2) {
            // Can't figure out odd numbered sets of digits
            return null;
        }

        const partsPerChunk = digitStrings.length / 2;
        const firstHalf = digitStrings.slice(0, partsPerChunk);
        const secondHalf = digitStrings.slice(partsPerChunk);

        return [firstHalf.join(' '), secondHalf.join(' ')];
    }

    private _cheapRuler(lat: number): CheapRuler {
        const rounded = lat.toFixed(2);
        const cached = this._cheapRulerCache.get(rounded);

        if (cached) {
            return cached;
        }

        if (this._cheapRulerCache.size >= 500) {
            // Expire the oldest 100 entries
            for (const key of [...this._cheapRulerCache.keys()].slice(0, 100)) {
                this._cheapRulerCache.delete(key);
            }
        }

        const cheapRuler = new CheapRuler(parseFloat(rounded), 'meters');
        this._cheapRulerCache.set(rounded, cheapRuler);

        return cheapRuler;
    }

    private _fromStringCity(str: string): Observable<LatLon | null> {
        return this._citiesService.getCityByName(str);
    }

    private _fromStringDegrees(str: string): Observable<LatLon | null> {
        const cleansed = str
            .toUpperCase()
            .replace(/[^-0-9.ENSW]+/g, ' ')
            .trim();
        let west = cleansed.indexOf('W') >= 0; // Force negative longitude
        let south = cleansed.indexOf('S') >= 0; // Force negative latitude
        const coordinateStrings = this._breakIntoCoordinateChunks(cleansed);

        if (!coordinateStrings) {
            return of(null);
        }

        const coordinates = coordinateStrings.map((item) =>
            this._parseCoordinateString(item)
        );

        if (coordinates[0] === null || coordinates[1] === null) {
            return of(null);
        }

        if (south) {
            coordinates[0] = -Math.abs(coordinates[0]);
        }

        if (west) {
            coordinates[1] = -Math.abs(coordinates[1]);
        }

        if (
            coordinates[0] < -90 ||
            coordinates[0] > 90 ||
            coordinates[1] < -180 ||
            coordinates[1] > 180
        ) {
            return of(null);
        }

        return of({
            lat: coordinates[0],
            lon: coordinates[1],
        });
    }

    private _fromStringMgrs(str: string): Observable<LatLon | null> {
        str = str.toUpperCase().trim();

        if (converter.isUSNG(str)) {
            const result = converter.USNGtoLL(str);

            return of({ lat: result.south, lon: result.west });
        }

        return of(null);
    }

    private _fromStringUtmUps(str: string): Observable<LatLon | null> {
        str = str.toUpperCase().trim();
        const tryConvert = (cb: () => any) => {
            let convertResult = null;

            try {
                convertResult = cb();
            } catch (ignore) {}

            if (convertResult) {
                return { lat: convertResult.lat, lon: convertResult.lon };
            }

            return null;
        };
        let result = null;
        const numbers = str
            .replace(/[^0-9.]+/g, ' ')
            .trim()
            .split(' ');
        const letter = str.replace(/[^A-Z]+/g, '').charAt(0);

        if (numbers.length >= 2 && numbers.length <= 3 && letter.length) {
            const easting = parseFloat(numbers[numbers.length - 2]);
            let northing = parseFloat(numbers[numbers.length - 1]);
            const isNorth = letter > 'M';

            if (
                letter === 'A' ||
                letter === 'B' ||
                letter === 'Y' ||
                letter === 'Z'
            ) {
                // Polar = UPS
                result = tryConvert(() =>
                    converter.UPStoLL({
                        easting,
                        northing,
                        northPole: isNorth,
                    })
                );
            } else if (numbers.length === 3) {
                // UTM
                // "northing" needs to be adjusted for southern hemisphere
                if (!isNorth) {
                    northing = northing - 10000000;
                }

                result = tryConvert(() =>
                    converter.UTMtoLL(
                        northing,
                        easting,
                        parseInt(numbers[0], 10)
                    )
                );
            }
        }

        return of(result);
    }

    private _padLeading(str: string): string {
        if (str.length === 1 || str.charAt(1) === '.') {
            return `0${str}`;
        }

        return str;
    }

    private _parseCoordinateString(str: string): number | null {
        const parts = str.split(/ /).map((item) => parseFloat(item));
        let negative = false;

        for (let i = 0; i < parts.length; i += 1) {
            if (isNaN(parts[i])) {
                return null;
            }

            if (parts[i] < 0) {
                negative = true;
                parts[i] = -parts[i];
            }
        }

        let multiplier = 1 / 60;
        let result = parts.shift()!;

        while (parts.length) {
            result += parts.shift()! * multiplier;
            multiplier /= 60;
        }

        if (negative) {
            result = -result;
        }

        return result;
    }

    private _toDDD(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';
        const latAbs = Math.abs(lat).toFixed(6);
        const lonAbs = Math.abs(lon).toFixed(6);

        return {
            lat: `${latDir} ${latAbs}°`,
            lon: `${lonDir} ${lonAbs}°`,
            latLon: `${latDir} ${latAbs} ${lonDir} ${lonAbs}`,
        };
    }

    private _toDDM(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';

        lat = Math.abs(lat);
        const latDeg = Math.floor(lat);
        const latMin = (lat - latDeg) * 60;
        const latMinFixed = this._padLeading(latMin.toFixed(3));

        lon = Math.abs(lon);
        const lonDeg = Math.floor(lon);
        const lonMin = (lon - lonDeg) * 60;
        const lonMinFixed = this._padLeading(lonMin.toFixed(3));

        return {
            lat: `${latDir} ${latDeg}° ${latMinFixed}'`,
            lon: `${lonDir} ${lonDeg}° ${lonMinFixed}'`,
            latLon: `${latDir} ${latDeg} ${latMinFixed} ${lonDir} ${lonDeg} ${lonMinFixed}`,
        };
    }

    private _toDMS(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';

        lat = Math.abs(lat);
        const latDeg = Math.floor(lat);
        lat = (lat - latDeg) * 60;
        const latMin = Math.floor(lat);
        const latMinFixed = this._padLeading(latMin.toFixed(0));
        const latSec = (lat - latMin) * 60;
        const latSecFixed = this._padLeading(latSec.toFixed(1));

        lon = Math.abs(lon);
        const lonDeg = Math.floor(lon);
        lon = (lon - lonDeg) * 60;
        const lonMin = Math.floor(lon);
        const lonMinFixed = this._padLeading(lonMin.toFixed(0));
        const lonSec = (lon - lonMin) * 60;
        const lonSecFixed = this._padLeading(lonSec.toFixed(1));

        return {
            lat: `${latDir} ${latDeg}° ${latMinFixed}' ${latSecFixed}"`,
            lon: `${lonDir} ${lonDeg}° ${lonMinFixed}' ${lonSecFixed}"`,
            latLon: `${latDir} ${latDeg} ${latMinFixed} ${latSecFixed} ${lonDir} ${lonDeg} ${lonMinFixed} ${lonSecFixed}`,
        };
    }

    private _toMGRS(lat: number, lon: number): MGRS {
        const mgrs = converter.LLtoUSNG(lat, lon, 6);
        const [zone, square, easting, northing] = mgrs.split(' ');

        return {
            zone,
            square,
            easting,
            northing,
            mgrs,
        };
    }

    private _toUTMUPS(lat: number, lon: number): UTMUPS {
        const utmups = converter.LLtoUTMUPS(lat, lon);
        const [zone, easting, northing] = utmups.split(' ');

        return {
            zone,
            easting,
            northing,
            utmups,
        };
    }
}
