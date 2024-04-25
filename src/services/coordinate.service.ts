import { BehaviorSubject } from 'rxjs';
import { Converter } from 'usng.js';

// By default, usng uses NAD83 but doesn't support WGS84. This is a workaround.
const converter = new (Converter as any)();
converter.ECC_SQUARED = 0.00669437999014;
converter.ECC_PRIME_SQUARED =
    converter.ECC_SQUARED / (1 - converter.ECC_SQUARED);
converter.E1 =
    (1 - Math.sqrt(1 - converter.ECC_SQUARED)) /
    (1 + Math.sqrt(1 - converter.ECC_SQUARED));

export enum CoordinateSystem {
    DMS = 'DMS',
    DDM = 'DDM',
    DDD = 'DDD',
    UTMUPS = 'UTM/UPS',
    MGRS = 'MGRS',
}
export const CoordinateSystemDefault = CoordinateSystem.DMS;

const COORDINATE_SYSTEMS = [
    CoordinateSystem.DMS,
    CoordinateSystem.DDM,
    CoordinateSystem.DDD,
    CoordinateSystem.UTMUPS,
    CoordinateSystem.MGRS,
];

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
    #currentSetting = new BehaviorSubject<CoordinateSystem>(
        CoordinateSystemDefault
    );

    constructor() {
        const storedSetting = localStorage.getItem('coordinateSystem');

        if (
            storedSetting &&
            COORDINATE_SYSTEMS.includes(storedSetting as CoordinateSystem)
        ) {
            this.#currentSetting.next(storedSetting as CoordinateSystem);
        }
    }

    fromString(str: string): LatLon | null {
        if (converter.isUSNG(str)) {
            const [lat, lon] = converter.USNGtoLL(str);
            return { lat, lon };
        }

        try {
            const [lat, lon] = converter.UTMUPStoLL(str);
            return { lat, lon };
        } catch (ignore) {}

        const cleansed = str.toUpperCase().replace(/[^-0-9.ENSW]+/g, ' ').trim();
        let west = cleansed.indexOf('W') >= 0; // Force negative longitude
        let south = cleansed.indexOf('S') >= 0; // Force negative latitude
        const coordinateStrings = this.#breakIntoCoordinateChunks(cleansed);

        if (!coordinateStrings) {
            return null;
        }

        const coordinates = coordinateStrings.map((item) => this.#parseCoordinateString(item));

        if (coordinates[0] === null || coordinates[1] === null) {
            return null;
        }

        if (south) {
            coordinates[0] = -Math.abs(coordinates[0]);
        }

        if (west) {
            coordinates[1] = -Math.abs(coordinates[1]);
        }

        return {
            lat: coordinates[0],
            lon: coordinates[1],
        };
    }

    getCurrentSetting() {
        return this.#currentSetting.asObservable();
    }

    latLonToSystem(lat: number, lon: number): LL | MGRS | UTMUPS {
        const currentSetting = this.#currentSetting.value;

        if (currentSetting === CoordinateSystem.DMS) {
            return this.#toDMS(lat, lon);
        }

        if (currentSetting === CoordinateSystem.DDM) {
            return this.#toDDM(lat, lon);
        }

        if (currentSetting === CoordinateSystem.DDD) {
            return this.#toDDD(lat, lon);
        }

        if (currentSetting === CoordinateSystem.UTMUPS) {
            return this.#toUTMUPS(lat, lon);
        }

        return this.#toMGRS(lat, lon);
    }

    toggleSystem() {
        const currentIndex = COORDINATE_SYSTEMS.indexOf(
            this.#currentSetting.value
        );
        const newIndex = (currentIndex + 1) % COORDINATE_SYSTEMS.length;
        this.#currentSetting.next(COORDINATE_SYSTEMS[newIndex]);
        localStorage.setItem('coordinateSystem', COORDINATE_SYSTEMS[newIndex]);
    }

    #breakIntoCoordinateChunks(cleansed: string): [string, string] | null {
        const coordinates = cleansed.split(/[ENSW]/).map((item) => item.trim()).filter((item) => item !== '');

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

    #padLeading(str: string): string {
        if (str.length === 1 || str.charAt(1) === '.') {
            return `0${str}`;
        }

        return str;
    }

    #parseCoordinateString(str: string): number | null {
        const parts = str.split(/ /).map((item) => parseFloat(item));

        for (const part of parts) {
            if (isNaN(part)) {
                return null;
            }
        }

        let multiplier = 1/60;
        let result = parts.shift()!;

        while (parts.length) {
            result += parts.shift()! * multiplier;
            multiplier /= 60;
        }

        return result;
    }

    #toDDD(lat: number, lon: number): LL {
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

    #toDDM(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';

        lat = Math.abs(lat);
        const latDeg = Math.floor(lat);
        const latMin = (lat - latDeg) * 60;
        const latMinFixed = this.#padLeading(latMin.toFixed(3));

        lon = Math.abs(lon);
        const lonDeg = Math.floor(lon);
        const lonMin = (lon - lonDeg) * 60;
        const lonMinFixed = this.#padLeading(lonMin.toFixed(3));

        return {
            lat: `${latDir} ${latDeg}° ${latMinFixed}'`,
            lon: `${lonDir} ${lonDeg}° ${lonMinFixed}'`,
            latLon: `${latDir} ${latDeg} ${latMinFixed} ${lonDir} ${lonDeg} ${lonMinFixed}`,
        };
    }

    #toDMS(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';

        lat = Math.abs(lat);
        const latDeg = Math.floor(lat);
        lat = (lat - latDeg) * 60;
        const latMin = Math.floor(lat);
        const latMinFixed = this.#padLeading(latMin.toFixed(0));
        const latSec = (lat - latMin) * 60;
        const latSecFixed = this.#padLeading(latSec.toFixed(1));

        lon = Math.abs(lon);
        const lonDeg = Math.floor(lon);
        lon = (lon - lonDeg) * 60;
        const lonMin = Math.floor(lon);
        const lonMinFixed = this.#padLeading(lonMin.toFixed(0));
        const lonSec = (lon - lonMin) * 60;
        const lonSecFixed = this.#padLeading(lonSec.toFixed(1));

        return {
            lat: `${latDir} ${latDeg}° ${latMinFixed}' ${latSecFixed}"`,
            lon: `${lonDir} ${lonDeg}° ${lonMinFixed}' ${lonSecFixed}"`,
            latLon: `${latDir} ${latDeg} ${latMinFixed} ${latSecFixed} ${lonDir} ${lonDeg} ${lonMinFixed} ${lonSecFixed}`,
        };
    }

    #toMGRS(lat: number, lon: number): MGRS {
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

    #toUTMUPS(lat: number, lon: number): UTMUPS {
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
