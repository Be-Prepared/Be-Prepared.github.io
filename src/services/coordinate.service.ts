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

export interface LL {
    lat: string;
    lon: string;
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
    #currentSetting = new BehaviorSubject<CoordinateSystem>(CoordinateSystemDefault);

    constructor() {
        const storedSetting = localStorage.getItem('coordinateSystem');

        if (storedSetting && COORDINATE_SYSTEMS.includes(storedSetting as CoordinateSystem)) {
            this.#currentSetting.next(storedSetting as CoordinateSystem);
        }
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

    #toDDD(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';

        return {
            lat: `${latDir} ${Math.abs(lat).toFixed(6)}°`,
            lon: `${lonDir} ${Math.abs(lon).toFixed(6)}°`,
        };
    }

    #toDDM(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';

        lat = Math.abs(lat);
        const latDeg = Math.floor(lat);
        const latMin = (lat - latDeg) * 60;

        lon = Math.abs(lon);
        const lonDeg = Math.floor(lon);
        const lonMin = (lon - lonDeg) * 60;

        return {
            lat: `${latDir} ${Math.floor(Math.abs(lat))}° ${latMin.toFixed(
                3
            )}'`,
            lon: `${lonDir} ${Math.floor(Math.abs(lon))}° ${lonMin.toFixed(
                3
            )}'`,
        };
    }

    #toDMS(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';

        lat = Math.abs(lat);
        const latDeg = Math.floor(lat);
        lat = (lat - latDeg) * 60;
        const latMin = Math.floor(lat);
        const latSec = (lat - latMin) * 60;

        lon = Math.abs(lon);
        const lonDeg = Math.floor(lon);
        lon = (lon - lonDeg) * 60;
        const lonMin = Math.floor(lon);
        const lonSec = (lon - lonMin) * 60;

        return {
            lat: `${latDir} ${latDeg}° ${latMin}' ${latSec.toFixed(1)}"`,
            lon: `${lonDir} ${lonDeg}° ${lonMin}' ${lonSec.toFixed(1)}"`,
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
