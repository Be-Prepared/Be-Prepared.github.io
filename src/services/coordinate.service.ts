import { BehaviorSubject } from 'rxjs';
import CheapRuler from 'cheap-ruler';
import { cities } from '../cities';
import { Converter } from 'usng.js';
import { CoordinateSystem } from '../datatypes/coordinate-system';
import { di } from 'fudgel';
import { DirectionService } from './direction.service';
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

const COORDINATE_SYSTEMS = [
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

export interface LatLon {
    lat: number;
    lon: number;
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

export class CoordinateService {
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

    fromString(str: string): LatLon | null {
        str = str.trim();

        if (converter.isUSNG(str)) {
            const [lat, lon] = converter.USNGtoLL(str);

            return { lat, lon };
        }

        try {
            const [lat, lon] = converter.UTMUPStoLL(str);

            return { lat, lon };
        } catch (ignore) {}

        const parsed = this._parseDegrees(str);

        if (parsed) {
            return parsed;
        }

        const cityCoords = this._lookupCity(str);

        if (cityCoords) {
            return cityCoords;
        }

        return null;
    }

    getCurrentSetting() {
        return this._currentSetting.asObservable();
    }

    getNearestMajorCity(lat: number, lon: number): NearestCity {
        const cheapRuler = new CheapRuler(lat, 'meters');
        const entries = [...Object.entries(cities)];
        const closest: NearestCity = entries.reduce<NearestCity>(
            (closest: NearestCity, city): NearestCity => {
                const cityName = city[0];
                const cityLat = city[1][0];
                const cityLon = city[1][1];
                const distance = cheapRuler.distance(
                    [lon, lat],
                    [cityLon, cityLat]
                );

                if (distance < closest.distance) {
                    const bearing = cheapRuler.bearing(
                        [lon, lat],
                        [cityLon, cityLat]
                    );

                    return {
                        name: cityName,
                        lat: cityLat,
                        lon: cityLon,
                        distance,
                        bearing,
                    };
                }

                return closest;
            },
            { name: '', lat: NaN, lon: NaN, distance: Infinity, bearing: NaN }
        );

        return closest;
    }

    latLonToSystem(lat: number, lon: number): LL | MGRS | UTMUPS {
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

    standardizeCoordinates(latLon: LatLon): LatLon {
        return {
            lat: this._directionService.standardizeLatitude(latLon.lat),
            lon: this._directionService.standardize180(latLon.lon),
        };
    }

    toggleSystem() {
        const currentIndex = COORDINATE_SYSTEMS.indexOf(
            this._currentSetting.value
        );
        const newIndex = (currentIndex + 1) % COORDINATE_SYSTEMS.length;
        this._currentSetting.next(COORDINATE_SYSTEMS[newIndex]);
        this._preferencesService.coordinateSystem.setItem(
            COORDINATE_SYSTEMS[newIndex]
        );
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

    private _lookupCity(str: string): LatLon | null {
        str = str.toLowerCase().trim();
        const strLen = str.length;

        for (const city of Object.keys(cities)) {
            if (city.length === strLen && city.toLowerCase() === str) {
                const [lat, lon] = cities[city];

                return { lat, lon };
            }
        }

        return null;
    }

    private _padLeading(str: string): string {
        if (str.length === 1 || str.charAt(1) === '.') {
            return `0${str}`;
        }

        return str;
    }

    private _parseCoordinateString(str: string): number | null {
        const parts = str.split(/ /).map((item) => parseFloat(item));

        for (const part of parts) {
            if (isNaN(part)) {
                return null;
            }
        }

        let multiplier = 1 / 60;
        let result = parts.shift()!;

        while (parts.length) {
            result += parts.shift()! * multiplier;
            multiplier /= 60;
        }

        return result;
    }

    private _parseDegrees(str: string): LatLon | null {
        const cleansed = str
            .toUpperCase()
            .replace(/[^-0-9.ENSW]+/g, ' ')
            .trim();
        let west = cleansed.indexOf('W') >= 0; // Force negative longitude
        let south = cleansed.indexOf('S') >= 0; // Force negative latitude
        const coordinateStrings = this._breakIntoCoordinateChunks(cleansed);

        if (!coordinateStrings) {
            return null;
        }

        const coordinates = coordinateStrings.map((item) =>
            this._parseCoordinateString(item)
        );

        if (coordinates[0] === null || coordinates[1] === null) {
            return null;
        }

        if (south) {
            coordinates[0] = -Math.abs(coordinates[0]);
        }

        if (west) {
            coordinates[1] = -Math.abs(coordinates[1]);
        }

        return this.standardizeCoordinates({
            lat: coordinates[0],
            lon: coordinates[1],
        });
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
