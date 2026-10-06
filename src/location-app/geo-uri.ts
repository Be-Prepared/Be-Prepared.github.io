// Reads geo: URIs (RFC 5870) handed to us by other apps. Pure; tested.
//
// They arrive in several shapes:
// * The manifest protocol handler passes the whole URI percent-encoded, such
//   as "web%2Bgeo%3A37.786971%2C-122.399677".
// * RFC 5870 allows an altitude and ";" parameters: "geo:1,2,3;u=35".
// * Android uses "geo:0,0?q=Address" to search and
//   "geo:0,0?q=37.78,-122.39(Name)" for a labeled pin.

import { nameFromGeoQuery } from './share-formats';

export interface GeoUri {
    lat: number;
    lon: number;
    name: string | null;
}

const NUMBER = /^\s*[-+]?(\d+(\.\d*)?|\.\d+)\s*$/;

function safeDecode(str: string) {
    try {
        return decodeURIComponent(str);
    } catch (ignore) {
        return str;
    }
}

function parseLatLon(str: string): { lat: number; lon: number } | null {
    const parts = str.split(',');

    // An optional third number is the altitude.
    if (parts.length < 2 || parts.length > 3) {
        return null;
    }

    for (const part of parts) {
        if (!NUMBER.test(part)) {
            return null;
        }
    }

    const lat = Number(parts[0]);
    const lon = Number(parts[1]);

    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return null;
    }

    return { lat, lon };
}

// extraSearch is a query string from elsewhere, such as the page's own
// location.search, used for parameters the URI itself doesn't have.
export function parseGeoUri(input: string, extraSearch = ''): GeoUri | null {
    let str = input.trim();

    // The whole URI was encoded, so the query keeps its own encoding after
    // one decode.
    if (/^(web(\+|%2b))?geo%3a/i.test(str)) {
        str = safeDecode(str);
    }

    str = str.replace(/^(web\+)?geo:/i, '');
    const queryIndex = str.indexOf('?');
    let query = '';

    if (queryIndex >= 0) {
        query = str.slice(queryIndex + 1);
        str = str.slice(0, queryIndex);
    }

    // Parameters such as ";u=35" and ";crs=wgs84".
    const coordinates = safeDecode(str).split(';')[0];
    const params = new URLSearchParams(query);

    for (const [key, value] of new URLSearchParams(
        extraSearch.replace(/^\?/, '').replace(/\?/g, '&')
    )) {
        if (!params.has(key)) {
            params.set(key, value);
        }
    }

    const q = params.get('q');
    let latLon = parseLatLon(coordinates);

    if (latLon && latLon.lat === 0 && latLon.lon === 0 && q) {
        // Android: 0,0 means "use the query". Only coordinates can be used
        // offline; an address search can't.
        const labeled = /^\s*([^(]*?)\s*(\(.*\))?\s*$/.exec(q);
        latLon = parseLatLon((labeled && labeled[1]) || '');
    }

    if (!latLon) {
        return null;
    }

    return {
        ...latLon,
        name: nameFromGeoQuery(q),
    };
}
