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
        const latMinFixed = latMin.toFixed(3);

        lon = Math.abs(lon);
        const lonDeg = Math.floor(lon);
        const lonMin = (lon - lonDeg) * 60;
        const lonMinFixed = lonMin.toFixed(3);

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
        const latSec = (lat - latMin) * 60;
        const latSecFixed = latSec.toFixed(1);

        lon = Math.abs(lon);
        const lonDeg = Math.floor(lon);
        lon = (lon - lonDeg) * 60;
        const lonMin = Math.floor(lon);
        const lonSec = (lon - lonMin) * 60;
        const lonSecFixed = lonSec.toFixed(1);

        return {
            lat: `${latDir} ${latDeg}° ${latMin}' ${latSecFixed}"`,
            lon: `${lonDir} ${lonDeg}° ${lonMin}' ${lonSecFixed}"`,
            latLon: `${latDir} ${latDeg} ${latMin} ${latSecFixed} ${lonDir} ${lonDeg} ${lonMin} ${lonSecFixed}`,
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
