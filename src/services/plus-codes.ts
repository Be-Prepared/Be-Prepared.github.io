// Plus Codes (Open Location Code) encoding and decoding.
//
// Ported to TypeScript from Google's reference JavaScript implementation,
// https://github.com/google/open-location-code (js/src/openlocationcode.js),
// following https://github.com/google/open-location-code/blob/main/docs/specification.md
//
// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Modifications: converted to a TypeScript module, functions return null
// instead of throwing on invalid input.

const SEPARATOR = '+';
const SEPARATOR_POSITION = 8;
const PADDING_CHARACTER = '0';
const CODE_ALPHABET = '23456789CFGHJMPQRVWX';
const ENCODING_BASE = CODE_ALPHABET.length;
const LATITUDE_MAX = 90;
const LONGITUDE_MAX = 180;
const MIN_DIGIT_COUNT = 2;
const MAX_DIGIT_COUNT = 15;
const PAIR_CODE_LENGTH = 10;
const PAIR_FIRST_PLACE_VALUE = Math.pow(ENCODING_BASE, PAIR_CODE_LENGTH / 2 - 1);
const PAIR_PRECISION = Math.pow(ENCODING_BASE, 3);
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];
const GRID_CODE_LENGTH = MAX_DIGIT_COUNT - PAIR_CODE_LENGTH;
const GRID_COLUMNS = 4;
const GRID_ROWS = 5;
const GRID_LAT_FIRST_PLACE_VALUE = Math.pow(GRID_ROWS, GRID_CODE_LENGTH - 1);
const GRID_LNG_FIRST_PLACE_VALUE = Math.pow(GRID_COLUMNS, GRID_CODE_LENGTH - 1);
const FINAL_LAT_PRECISION =
    PAIR_PRECISION * Math.pow(GRID_ROWS, MAX_DIGIT_COUNT - PAIR_CODE_LENGTH);
const FINAL_LNG_PRECISION =
    PAIR_PRECISION * Math.pow(GRID_COLUMNS, MAX_DIGIT_COUNT - PAIR_CODE_LENGTH);
const MIN_TRIMMABLE_CODE_LEN = 6;

export const PLUS_CODE_LENGTH_NORMAL = 10;
export const PLUS_CODE_LENGTH_EXTRA = 11;

export interface PlusCodeArea {
    latitudeLo: number;
    longitudeLo: number;
    latitudeHi: number;
    longitudeHi: number;
    codeLength: number;
    latitudeCenter: number;
    longitudeCenter: number;
}

export function isValidPlusCode(code: string): boolean {
    if (!code || typeof code !== 'string') {
        return false;
    }

    const separatorIndex = code.indexOf(SEPARATOR);

    // Exactly one separator, at an even position no later than 8.
    if (separatorIndex === -1 || separatorIndex !== code.lastIndexOf(SEPARATOR)) {
        return false;
    }

    if (code.length === 1) {
        return false;
    }

    if (separatorIndex > SEPARATOR_POSITION || separatorIndex % 2 === 1) {
        return false;
    }

    if (code.indexOf(PADDING_CHARACTER) > -1) {
        // Padding is only allowed in full codes, not at the start, as a
        // single even-length run, and with nothing after the separator.
        if (separatorIndex < SEPARATOR_POSITION) {
            return false;
        }

        if (code.indexOf(PADDING_CHARACTER) === 0) {
            return false;
        }

        const padMatch = code.match(/0+/g)!;

        if (
            padMatch.length > 1 ||
            padMatch[0].length % 2 === 1 ||
            padMatch[0].length > SEPARATOR_POSITION - 2
        ) {
            return false;
        }

        if (code.charAt(code.length - 1) !== SEPARATOR) {
            return false;
        }
    }

    // A single character after the separator is not allowed.
    if (code.length - separatorIndex - 1 === 1) {
        return false;
    }

    const stripped = code.replace(/\++/, '').replace(/0+/, '');

    for (const character of stripped) {
        if (CODE_ALPHABET.indexOf(character.toUpperCase()) === -1) {
            return false;
        }
    }

    return true;
}

export function isShortPlusCode(code: string): boolean {
    if (!isValidPlusCode(code)) {
        return false;
    }

    const separatorIndex = code.indexOf(SEPARATOR);

    return separatorIndex >= 0 && separatorIndex < SEPARATOR_POSITION;
}

export function isFullPlusCode(code: string): boolean {
    if (!isValidPlusCode(code) || isShortPlusCode(code)) {
        return false;
    }

    // The first characters must not exceed the latitude and longitude range.
    const firstLatValue =
        CODE_ALPHABET.indexOf(code.charAt(0).toUpperCase()) * ENCODING_BASE;

    if (firstLatValue >= LATITUDE_MAX * 2) {
        return false;
    }

    if (code.length > 1) {
        const firstLngValue =
            CODE_ALPHABET.indexOf(code.charAt(1).toUpperCase()) * ENCODING_BASE;

        if (firstLngValue >= LONGITUDE_MAX * 2) {
            return false;
        }
    }

    return true;
}

// Converts degrees to the integer values used for encoding. Integer math
// avoids floating point rounding differences between implementations.
export function plusCodeLocationToIntegers(
    latitude: number,
    longitude: number
): [number, number] {
    let latVal = roundToInteger(latitude * FINAL_LAT_PRECISION);
    latVal += LATITUDE_MAX * FINAL_LAT_PRECISION;

    if (latVal < 0) {
        latVal = 0;
    } else if (latVal >= 2 * LATITUDE_MAX * FINAL_LAT_PRECISION) {
        latVal = 2 * LATITUDE_MAX * FINAL_LAT_PRECISION - 1;
    }

    const lngRange = 2 * LONGITUDE_MAX * FINAL_LNG_PRECISION;
    let lngVal = roundToInteger(longitude * FINAL_LNG_PRECISION);
    lngVal += LONGITUDE_MAX * FINAL_LNG_PRECISION;

    if (lngVal < 0) {
        lngVal = (lngVal % lngRange) + lngRange;
    } else if (lngVal >= lngRange) {
        lngVal = lngVal % lngRange;
    }

    return [latVal, lngVal];
}

export function encodePlusCodeIntegers(
    latInt: number,
    lngInt: number,
    codeLength: number = PLUS_CODE_LENGTH_NORMAL
): string | null {
    codeLength = Math.min(MAX_DIGIT_COUNT, codeLength);

    if (isNaN(latInt) || isNaN(lngInt) || isNaN(codeLength)) {
        return null;
    }

    if (
        codeLength < MIN_DIGIT_COUNT ||
        (codeLength < PAIR_CODE_LENGTH && codeLength % 2 === 1)
    ) {
        return null;
    }

    const code: string[] = new Array(MAX_DIGIT_COUNT + 1);
    code[SEPARATOR_POSITION] = SEPARATOR;

    if (codeLength > PAIR_CODE_LENGTH) {
        // Grid digits, least significant first.
        for (let i = MAX_DIGIT_COUNT - PAIR_CODE_LENGTH; i >= 1; i -= 1) {
            const latDigit = latInt % GRID_ROWS;
            const lngDigit = lngInt % GRID_COLUMNS;
            code[SEPARATOR_POSITION + 2 + i] = CODE_ALPHABET.charAt(
                latDigit * GRID_COLUMNS + lngDigit
            );
            latInt = Math.floor(latInt / GRID_ROWS);
            lngInt = Math.floor(lngInt / GRID_COLUMNS);
        }
    } else {
        latInt = Math.floor(latInt / Math.pow(GRID_ROWS, GRID_CODE_LENGTH));
        lngInt = Math.floor(lngInt / Math.pow(GRID_COLUMNS, GRID_CODE_LENGTH));
    }

    // The last pair goes after the separator.
    code[SEPARATOR_POSITION + 1] = CODE_ALPHABET.charAt(latInt % ENCODING_BASE);
    code[SEPARATOR_POSITION + 2] = CODE_ALPHABET.charAt(lngInt % ENCODING_BASE);
    latInt = Math.floor(latInt / ENCODING_BASE);
    lngInt = Math.floor(lngInt / ENCODING_BASE);

    for (let i = PAIR_CODE_LENGTH / 2 + 1; i >= 0; i -= 2) {
        code[i] = CODE_ALPHABET.charAt(latInt % ENCODING_BASE);
        code[i + 1] = CODE_ALPHABET.charAt(lngInt % ENCODING_BASE);
        latInt = Math.floor(latInt / ENCODING_BASE);
        lngInt = Math.floor(lngInt / ENCODING_BASE);
    }

    if (codeLength >= SEPARATOR_POSITION) {
        return code.slice(0, codeLength + 1).join('');
    }

    return (
        code.slice(0, codeLength).join('') +
        PADDING_CHARACTER.repeat(SEPARATOR_POSITION - codeLength) +
        SEPARATOR
    );
}

export function encodePlusCode(
    latitude: number,
    longitude: number,
    codeLength: number = PLUS_CODE_LENGTH_NORMAL
): string | null {
    const [latInt, lngInt] = plusCodeLocationToIntegers(latitude, longitude);

    return encodePlusCodeIntegers(latInt, lngInt, codeLength);
}

export function decodePlusCode(code: string): PlusCodeArea | null {
    if (!isFullPlusCode(code)) {
        return null;
    }

    code = code.replace('+', '').replace(/0/g, '').toUpperCase();
    let normalLat = -LATITUDE_MAX * PAIR_PRECISION;
    let normalLng = -LONGITUDE_MAX * PAIR_PRECISION;
    let gridLat = 0;
    let gridLng = 0;
    let digits = Math.min(code.length, PAIR_CODE_LENGTH);
    let pv = PAIR_FIRST_PLACE_VALUE;

    for (let i = 0; i < digits; i += 2) {
        normalLat += CODE_ALPHABET.indexOf(code.charAt(i)) * pv;
        normalLng += CODE_ALPHABET.indexOf(code.charAt(i + 1)) * pv;

        if (i < digits - 2) {
            pv /= ENCODING_BASE;
        }
    }

    let latPrecision = pv / PAIR_PRECISION;
    let lngPrecision = pv / PAIR_PRECISION;

    if (code.length > PAIR_CODE_LENGTH) {
        let rowpv = GRID_LAT_FIRST_PLACE_VALUE;
        let colpv = GRID_LNG_FIRST_PLACE_VALUE;
        digits = Math.min(code.length, MAX_DIGIT_COUNT);

        for (let i = PAIR_CODE_LENGTH; i < digits; i += 1) {
            const digitVal = CODE_ALPHABET.indexOf(code.charAt(i));
            gridLat += Math.floor(digitVal / GRID_COLUMNS) * rowpv;
            gridLng += (digitVal % GRID_COLUMNS) * colpv;

            if (i < digits - 1) {
                rowpv /= GRID_ROWS;
                colpv /= GRID_COLUMNS;
            }
        }

        latPrecision = rowpv / FINAL_LAT_PRECISION;
        lngPrecision = colpv / FINAL_LNG_PRECISION;
    }

    const lat = normalLat / PAIR_PRECISION + gridLat / FINAL_LAT_PRECISION;
    const lng = normalLng / PAIR_PRECISION + gridLng / FINAL_LNG_PRECISION;

    return makeArea(
        lat,
        lng,
        lat + latPrecision,
        lng + lngPrecision,
        Math.min(code.length, MAX_DIGIT_COUNT)
    );
}

// Finds the full code nearest the reference location that matches a short
// code. Full codes are returned unchanged (upper case).
export function recoverNearestPlusCode(
    shortCode: string,
    referenceLatitude: number,
    referenceLongitude: number
): string | null {
    if (!isShortPlusCode(shortCode)) {
        if (isFullPlusCode(shortCode)) {
            return shortCode.toUpperCase();
        }

        return null;
    }

    if (isNaN(referenceLatitude) || isNaN(referenceLongitude)) {
        return null;
    }

    referenceLatitude = clipLatitude(referenceLatitude);
    referenceLongitude = normalizeLongitude(referenceLongitude);
    shortCode = shortCode.toUpperCase();
    const paddingLength = SEPARATOR_POSITION - shortCode.indexOf(SEPARATOR);
    // The resolution of the digits that were removed.
    const resolution = Math.pow(20, 2 - paddingLength / 2);
    const halfResolution = resolution / 2.0;
    const referenceCode = encodePlusCode(referenceLatitude, referenceLongitude)!;
    const codeArea = decodePlusCode(
        referenceCode.substring(0, paddingLength) + shortCode
    );

    if (!codeArea) {
        return null;
    }

    // If the recovered area is more than half a resolution away from the
    // reference, the neighboring cell is closer. Latitude doesn't wrap.
    if (
        referenceLatitude + halfResolution < codeArea.latitudeCenter &&
        codeArea.latitudeCenter - resolution >= -LATITUDE_MAX
    ) {
        codeArea.latitudeCenter -= resolution;
    } else if (
        referenceLatitude - halfResolution > codeArea.latitudeCenter &&
        codeArea.latitudeCenter + resolution <= LATITUDE_MAX
    ) {
        codeArea.latitudeCenter += resolution;
    }

    if (referenceLongitude + halfResolution < codeArea.longitudeCenter) {
        codeArea.longitudeCenter -= resolution;
    } else if (referenceLongitude - halfResolution > codeArea.longitudeCenter) {
        codeArea.longitudeCenter += resolution;
    }

    return encodePlusCode(
        codeArea.latitudeCenter,
        codeArea.longitudeCenter,
        codeArea.codeLength
    );
}

// Removes as many leading digits as is safe for the given reference location.
export function shortenPlusCode(
    code: string,
    latitude: number,
    longitude: number
): string | null {
    if (!isFullPlusCode(code) || code.indexOf(PADDING_CHARACTER) !== -1) {
        return null;
    }

    code = code.toUpperCase();
    const codeArea = decodePlusCode(code);

    if (!codeArea || codeArea.codeLength < MIN_TRIMMABLE_CODE_LEN) {
        return null;
    }

    if (isNaN(latitude) || isNaN(longitude)) {
        return null;
    }

    latitude = clipLatitude(latitude);
    longitude = normalizeLongitude(longitude);
    const range = Math.max(
        Math.abs(codeArea.latitudeCenter - latitude),
        Math.abs(codeArea.longitudeCenter - longitude)
    );

    for (let i = PAIR_RESOLUTIONS.length - 2; i >= 1; i -= 1) {
        // 0.3 instead of 0.5 leaves a safety margin for the recovery.
        if (range < PAIR_RESOLUTIONS[i] * 0.3) {
            return code.substring((i + 1) * 2);
        }
    }

    return code;
}

function clipLatitude(latitude: number) {
    return Math.min(LATITUDE_MAX, Math.max(-LATITUDE_MAX, latitude));
}

function normalizeLongitude(longitude: number) {
    while (longitude < -LONGITUDE_MAX) {
        longitude += 360;
    }

    while (longitude >= LONGITUDE_MAX) {
        longitude -= 360;
    }

    return longitude;
}

function makeArea(
    latitudeLo: number,
    longitudeLo: number,
    latitudeHi: number,
    longitudeHi: number,
    codeLength: number
): PlusCodeArea {
    return {
        latitudeLo,
        longitudeLo,
        latitudeHi,
        longitudeHi,
        codeLength,
        latitudeCenter: Math.min(
            latitudeLo + (latitudeHi - latitudeLo) / 2,
            LATITUDE_MAX
        ),
        longitudeCenter: Math.min(
            longitudeLo + (longitudeHi - longitudeLo) / 2,
            LONGITUDE_MAX
        ),
    };
}

// Degrees like 40.6 have no exact binary representation, so multiplying can
// give 3264999999.9999995 instead of 3265000000. Rounding to a millionth
// before taking the floor matches the integers in the specification's tests.
function roundToInteger(value: number) {
    return Math.floor(Math.round(value * 1e6) / 1e6);
}
