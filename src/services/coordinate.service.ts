import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import CheapRuler from 'cheap-ruler';
import { CitiesService } from './cities.service';
import { Converter } from 'usng.js';
import { CoordinateSystem } from '../datatypes/coordinate-system';
import { di } from '../di';
import { DirectionService } from './direction.service';
import { default as ecefProjector } from 'ecef-projector';
import { LatLon } from '../datatypes/lat-lon';
import { map } from 'rxjs/operators';
import {
    decodePlusCode,
    isFullPlusCode,
    isShortPlusCode,
    isValidPlusCode,
    PLUS_CODE_LENGTH_EXTRA,
    encodePlusCode,
    recoverNearestPlusCode,
} from './plus-codes';
import { PreferenceService } from './preference.service';
import { XYZ } from '../datatypes/xyz';

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
    CoordinateSystem.PLUSCODE,
];

// Latitude bands for UTM and MGRS, south to north.
const UTM_BANDS = 'CDEFGHJKLMNPQRSTUVWX';

// "UJ 2337 0651", "UJ23370651", or "2337 0651" (zone and square omitted).
const MGRS_SHORTHAND_SQUARE =
    /^([A-HJ-NP-Z])([A-HJ-NP-V]) ?(?:(\d{1,5}) (\d{1,5})|(\d{2,10}))$/;
const MGRS_SHORTHAND_DIGITS = /^(\d{1,5}) (\d{1,5})$/;

// "J 123456 1234567" or "123456mE 1234567mN" (zone omitted).
const UTM_SHORTHAND =
    /^(?:([C-HJ-NP-X]) ?)?(\d{6}(?:\.\d+)?) ?(?:ME?)? (\d{1,7}(?:\.\d+)?) ?(?:MN?)?$/;

// A plus code, optionally followed by a city name ("CWC8+R9 Mountain View").
const PLUS_CODE =
    /^([23456789CFGHJMPQRVWX0]{0,8}\+[23456789CFGHJMPQRVWX]*)(?:[ ,]+(.+))?$/i;

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

export interface PlusCode {
    pluscode: string;
}

export type SystemCoordinates = LL | MGRS | UTMUPS | PlusCode;

export class CoordinateService {
    private _cheapRulerCache = new Map<string, CheapRuler>();
    private _citiesService = di(CitiesService);
    private _currentSetting = new BehaviorSubject<CoordinateSystem>(
        CoordinateSystemDefault
    );
    private _directionService = di(DirectionService);
    private _preferenceService = di(PreferenceService);

    constructor() {
        const storedSetting =
            this._preferenceService.coordinateSystem.getItem();

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

    // Clears the cache. Used for tests.
    clearCache() {
        this._cheapRulerCache.clear();
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

    // Parses a location. Shorthand (MGRS without the grid zone, UTM without
    // the zone number, short plus codes) is filled in with the candidate
    // closest to the reference location and fails when there is no reference.
    fromString(
        str: string,
        reference?: LatLon | null
    ): Observable<LatLon | null> {
        str = str.trim();
        const plusCode = this._matchPlusCode(str);

        if (plusCode) {
            // Plus codes are checked on their own because the degree parser
            // would happily turn "CWC8+R9" into 8° N 9° W.
            return this._fromStringPlusCode(plusCode[0], plusCode[1], reference);
        }

        return forkJoin([
            this._fromStringDegrees(str),
            this._fromStringMgrs(str),
            this._fromStringUtmUps(str),
            this._fromStringCity(str),
        ]).pipe(
            map(([degrees, mgrs, utmUps, city]) => {
                const parsed = degrees || mgrs || utmUps || city;

                if (parsed) {
                    return parsed;
                }

                if (reference) {
                    return (
                        this._fromStringMgrsShorthand(str, reference) ||
                        this._fromStringUtmShorthand(str, reference)
                    );
                }

                return null;
            })
        );
    }

    // True when the text is shorthand that can only be understood relative to
    // a reference location, such as the current GPS position.
    needsReference(str: string): boolean {
        const plusCode = this._matchPlusCode(str);

        if (plusCode) {
            return !plusCode[1] && isShortPlusCode(plusCode[0]);
        }

        const cleansed = this._cleanseShorthand(str);

        return (
            MGRS_SHORTHAND_SQUARE.test(cleansed) ||
            MGRS_SHORTHAND_DIGITS.test(cleansed) ||
            UTM_SHORTHAND.test(cleansed)
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

        if (currentSetting === CoordinateSystem.PLUSCODE) {
            return this._toPlusCode(lat, lon);
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

        if ('pluscode' in system) {
            return system.pluscode;
        }

        return system.utmups;
    }

    latLonToXYZ(latLon: LatLon): XYZ {
        const [x, y, z] = ecefProjector.project(latLon.lat, latLon.lon, 0);

        return {
            x,
            y,
            z,
        };
    }

    reset() {
        this._preferenceService.coordinateSystem.reset();
        this._currentSetting.next(CoordinateSystemDefault);
    }

    setCoordinateSystem(system: CoordinateSystem) {
        if (COORDINATE_SYSTEMS.includes(system as CoordinateSystem)) {
            this._currentSetting.next(system as CoordinateSystem);
            this._preferenceService.coordinateSystem.setItem(system);
        }
    }

    standardizeCoordinates(latLon: LatLon): LatLon {
        return {
            lat: this._directionService.standardizeLatitude(latLon.lat),
            lon: this._directionService.standardize180(latLon.lon),
        };
    }

    xyzToLatLon(xyz: XYZ): LatLon {
        const [lat, lon] = ecefProjector.unproject(xyz.x, xyz.y, xyz.z);

        return {
            lat,
            lon,
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

    private _cleanseShorthand(str: string) {
        return str.toUpperCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
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

    // Fills in the grid zone (and the 100 km square when it is missing too)
    // using the candidate closest to the reference. That may be in a
    // neighboring square or zone instead of the reference's own.
    private _fromStringMgrsShorthand(
        str: string,
        reference: LatLon
    ): LatLon | null {
        const cleansed = this._cleanseShorthand(str);
        let prefixes: string[];
        let easting: string;
        let northing: string;
        const withSquare = cleansed.match(MGRS_SHORTHAND_SQUARE);

        if (withSquare) {
            const square = withSquare[1] + withSquare[2];

            if (withSquare[5]) {
                if (withSquare[5].length % 2) {
                    return null;
                }

                const half = withSquare[5].length / 2;
                easting = withSquare[5].slice(0, half);
                northing = withSquare[5].slice(half);
            } else {
                easting = withSquare[3];
                northing = withSquare[4];
            }

            // A square's letters repeat every 2,000 km north to south and
            // every three zones east to west. Each band letter selects a
            // different 2,000 km cycle.
            prefixes = [];

            for (const zone of this._nearbyZones(reference, 2)) {
                for (const band of UTM_BANDS) {
                    prefixes.push(`${zone}${band}${square}`);
                }
            }
        } else {
            const digitsOnly = cleansed.match(MGRS_SHORTHAND_DIGITS);

            if (!digitsOnly) {
                return null;
            }

            easting = digitsOnly[1];
            northing = digitsOnly[2];
            prefixes = this._nearbyMgrsSquares(reference);
        }

        if (easting.length !== northing.length) {
            return null;
        }

        let best: LatLon | null = null;
        let bestDistance = Infinity;

        for (const prefix of prefixes) {
            const candidate = this._mgrsCandidate(
                `${prefix}${easting}${northing}`
            );

            if (candidate) {
                const distance = this._greatCircleDistance(
                    reference,
                    candidate
                );

                if (distance < bestDistance) {
                    best = candidate;
                    bestDistance = distance;
                }
            }
        }

        return best;
    }

    private _fromStringPlusCode(
        code: string,
        locality: string,
        reference?: LatLon | null
    ): Observable<LatLon | null> {
        const decodeCenter = (fullCode: string | null) => {
            const area = fullCode ? decodePlusCode(fullCode) : null;

            return area
                ? { lat: area.latitudeCenter, lon: area.longitudeCenter }
                : null;
        };

        if (isFullPlusCode(code)) {
            // A full code doesn't need the locality, so it is ignored.
            return of(decodeCenter(code));
        }

        if (locality) {
            return this._citiesService
                .getCityByName(locality)
                .pipe(
                    map((city) =>
                        city
                            ? decodeCenter(
                                  recoverNearestPlusCode(code, city.lat, city.lon)
                              )
                            : null
                    )
                );
        }

        if (reference) {
            return of(
                decodeCenter(
                    recoverNearestPlusCode(code, reference.lat, reference.lon)
                )
            );
        }

        return of(null);
    }

    // Fills in the zone number (and the hemisphere when the band letter is
    // missing) using the candidate closest to the reference.
    private _fromStringUtmShorthand(
        str: string,
        reference: LatLon
    ): LatLon | null {
        const match = this._cleanseShorthand(str).match(UTM_SHORTHAND);

        if (!match) {
            return null;
        }

        const band = match[1];
        const easting = parseFloat(match[2]);
        const northing = parseFloat(match[3]);
        const hemispheres = band ? [band >= 'N'] : [true, false];
        let best: LatLon | null = null;
        let bestDistance = Infinity;

        for (const zone of this._nearbyZones(reference, 1)) {
            for (const isNorth of hemispheres) {
                let candidate: LatLon | null = null;

                try {
                    const result = converter.UTMtoLL(
                        isNorth ? northing : northing - 10000000,
                        easting,
                        zone
                    );

                    if (isFinite(result.lat) && isFinite(result.lon)) {
                        candidate = { lat: result.lat, lon: result.lon };
                    }
                } catch (ignore) {}

                if (candidate) {
                    const distance = this._greatCircleDistance(
                        reference,
                        candidate
                    );

                    if (distance < bestDistance) {
                        best = candidate;
                        bestDistance = distance;
                    }
                }
            }
        }

        return best;
    }

    private _fromStringUtmUps(str: string): Observable<LatLon | null> {
        str = str.toUpperCase().trim();
        const tryConvert = (cb: () => any) => {
            let convertResult = null;

            try {
                convertResult = cb();
            } catch (ignore) {}

            if (
                convertResult &&
                Math.abs(convertResult.lat) <= 90 &&
                Math.abs(convertResult.lon) <= 180
            ) {
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
            } else if (
                numbers.length === 3 &&
                parseInt(numbers[0], 10) >= 1 &&
                parseInt(numbers[0], 10) <= 60
            ) {
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

    // Haversine distance. Unlike CheapRuler it stays accurate over the
    // hundreds of kilometers between shorthand candidates and across the
    // antimeridian.
    private _greatCircleDistance(a: LatLon, b: LatLon): number {
        const toRad = Math.PI / 180;
        const dLat = (b.lat - a.lat) * toRad;
        const dLon = (b.lon - a.lon) * toRad;
        const h =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * toRad) *
                Math.cos(b.lat * toRad) *
                Math.sin(dLon / 2) ** 2;

        return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    // Decodes a full MGRS string and checks that it really is in the zone and
    // 100 km square it claims. Square letters that don't exist in a zone
    // decode to a misleading location.
    // Returns the upper case code and the locality ('' when there is none)
    // when the text is a valid plus code. A locality must contain a letter
    // so "+45 +70" is still read as degrees.
    private _matchPlusCode(str: string): [string, string] | null {
        const match = str.trim().match(PLUS_CODE);

        if (!match || !isValidPlusCode(match[1])) {
            return null;
        }

        const locality = (match[2] || '').trim();

        if (locality && !/\p{L}/u.test(locality)) {
            return null;
        }

        return [match[1].toUpperCase(), locality];
    }

    private _mgrsCandidate(mgrs: string): LatLon | null {
        try {
            if (!converter.isUSNG(mgrs)) {
                return null;
            }

            const area = converter.USNGtoLL(mgrs);

            if (!isFinite(area.south) || !isFinite(area.west)) {
                return null;
            }

            const check = converter.LLtoUSNG(
                (area.north + area.south) / 2,
                (area.east + area.west) / 2,
                1
            );
            const [zoneBand, square] = check.split(' ');
            const wanted = mgrs.match(/^(\d+)[A-Z]([A-Z]{2})/)!;

            if (
                parseInt(zoneBand, 10) !== parseInt(wanted[1], 10) ||
                square !== wanted[2]
            ) {
                return null;
            }

            // Same corner as full MGRS references.
            return { lat: area.south, lon: area.west };
        } catch (ignore) {
            return null;
        }
    }

    // Grid zone and 100 km square prefixes ("18SUJ") around the reference.
    // Digits repeat every 100 km, so the closest match is within about one
    // square of the reference; sampling 150 km around it covers that.
    private _nearbyMgrsSquares(reference: LatLon): string[] {
        const prefixes = new Set<string>();
        const step = 50000;
        const metersPerDegree = 111320;

        for (let dy = -3; dy <= 3; dy += 1) {
            const lat = reference.lat + (dy * step) / metersPerDegree;

            if (lat < -80 || lat > 84) {
                continue;
            }

            const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);

            for (let dx = -3; dx <= 3; dx += 1) {
                const lon = this._directionService.standardize180(
                    reference.lon + (dx * step) / (metersPerDegree * cosLat)
                );

                try {
                    prefixes.add(
                        converter.LLtoUSNG(lat, lon, 1).replace(/ /g, '')
                    );
                } catch (ignore) {}
            }
        }

        return [...prefixes];
    }

    // UTM zone numbers within `spread` zones of the reference, wrapping
    // around the antimeridian.
    private _nearbyZones(reference: LatLon, spread: number): number[] {
        if (reference.lat < -80 || reference.lat > 84) {
            return [];
        }

        const lon = this._directionService.standardize180(reference.lon);
        const zone = Math.min(Math.floor((lon + 180) / 6) + 1, 60);
        const zones: number[] = [];

        for (let offset = -spread; offset <= spread; offset += 1) {
            zones.push(((zone + offset + 59) % 60) + 1);
        }

        return zones;
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

    // Rounds once, in the smallest unit shown, and then splits into parts.
    // Rounding each part separately can show 59.96 seconds as "60.0"
    // instead of carrying into the next minute.
    private _splitDDM(value: number) {
        const thousandthsOfMinutes = Math.round(Math.abs(value) * 60000);

        return {
            degrees: Math.floor(thousandthsOfMinutes / 60000),
            minutes: (thousandthsOfMinutes % 60000) / 1000,
        };
    }

    private _splitDMS(value: number) {
        const tenthsOfSeconds = Math.round(Math.abs(value) * 36000);

        return {
            degrees: Math.floor(tenthsOfSeconds / 36000),
            minutes: Math.floor((tenthsOfSeconds % 36000) / 600),
            seconds: (tenthsOfSeconds % 600) / 10,
        };
    }

    private _toDDM(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';
        const latParts = this._splitDDM(lat);
        const lonParts = this._splitDDM(lon);
        const latDeg = latParts.degrees;
        const latMinFixed = this._padLeading(latParts.minutes.toFixed(3));
        const lonDeg = lonParts.degrees;
        const lonMinFixed = this._padLeading(lonParts.minutes.toFixed(3));

        return {
            lat: `${latDir} ${latDeg}° ${latMinFixed}'`,
            lon: `${lonDir} ${lonDeg}° ${lonMinFixed}'`,
            latLon: `${latDir} ${latDeg} ${latMinFixed} ${lonDir} ${lonDeg} ${lonMinFixed}`,
        };
    }

    private _toDMS(lat: number, lon: number): LL {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';
        const latParts = this._splitDMS(lat);
        const lonParts = this._splitDMS(lon);
        const latDeg = latParts.degrees;
        const latMinFixed = this._padLeading(latParts.minutes.toFixed(0));
        const latSecFixed = this._padLeading(latParts.seconds.toFixed(1));
        const lonDeg = lonParts.degrees;
        const lonMinFixed = this._padLeading(lonParts.minutes.toFixed(0));
        const lonSecFixed = this._padLeading(lonParts.seconds.toFixed(1));

        return {
            lat: `${latDir} ${latDeg}° ${latMinFixed}' ${latSecFixed}"`,
            lon: `${lonDir} ${lonDeg}° ${lonMinFixed}' ${lonSecFixed}"`,
            latLon: `${latDir} ${latDeg} ${latMinFixed} ${latSecFixed} ${lonDir} ${lonDeg} ${lonMinFixed} ${lonSecFixed}`,
        };
    }

    private _toMGRS(lat: number, lon: number): MGRS | UTMUPS {
        let mgrs: string;

        try {
            mgrs = converter.LLtoUSNG(lat, lon, 6);
        } catch (ignore) {
            // usng.js has no polar MGRS (north of 84° N, south of 80° S) and
            // rounds points next to the poles out of range. UPS covers both.
            return this._toUTMUPS(lat, lon);
        }

        const [zone, square, easting, northing] = mgrs.split(' ');

        return {
            zone,
            square,
            easting,
            northing,
            mgrs,
        };
    }

    private _toPlusCode(lat: number, lon: number): PlusCode {
        // 11 digits is a cell of about 3 by 3 meters.
        return {
            pluscode: encodePlusCode(lat, lon, PLUS_CODE_LENGTH_EXTRA) || '',
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
