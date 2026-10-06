// Ways to share a waypoint. Map apps disagree on how to read a shared
// location, so each format says where it works. Pure functions; tested.
//
// What we know (October 2026):
// * iPhone: Safari doesn't open geo: links in Apple Maps, and a geo: link's
//   "q" is treated as a search, so the name wins over the coordinates.
//   Apple Maps links do work. The unified /place URL is used (iOS 18.4,
//   from 2025, and later); older iPhones open the Apple Maps website.
// * Android: geo: opens the default map app. "geo:lat,lon?q=lat,lon(Name)"
//   drops a labeled pin; "geo:lat,lon?q=Name" searches for Name instead.
// * Google Maps links take coordinates but no label.
// * Plain text coordinates can be pasted into nearly any map's search box.

export type ShareFormatId =
    | 'be-prepared'
    | 'geo-full'
    | 'geo-basic'
    | 'google-maps'
    | 'apple-maps'
    | 'decimal-text'
    | 'display-text';

// Most phones are Android, so their options come first; Apple Maps is
// listed just before the plain text options. Each option opens something
// different: geo: links open the default map or GPS app (Android, works
// offline), the Google Maps link is a web address that works on any
// device, and the Apple Maps link opens Apple Maps on iPhones.
export const SHARE_FORMATS: ShareFormatId[] = [
    'be-prepared',
    'geo-full',
    'geo-basic',
    'google-maps',
    'apple-maps',
    'decimal-text',
    'display-text',
];

export interface SharePoint {
    lat: number;
    lon: number;
    name: string;
}

export interface ShareContext {
    // The app's own address, ending in "/".
    website: string;
    // The location written in the person's chosen coordinate format.
    displayText: string;
}

// 7 decimal places is about 1 cm, more than any phone GPS can use.
export function formatDecimal(value: number) {
    return (Math.round(value * 1e7) / 1e7).toFixed(7).replace(/\.?0+$/, '');
}

// encodeURIComponent leaves ( ) alone, but they mark the label in geo:
// links, so they have to be escaped inside names.
function encodeLabel(text: string) {
    return encodeURIComponent(text).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

export function buildShare(
    format: ShareFormatId,
    point: SharePoint,
    context: ShareContext
): string {
    const lat = formatDecimal(point.lat);
    const lon = formatDecimal(point.lon);
    const name = point.name.trim();
    const label = encodeLabel(name);

    switch (format) {
        case 'be-prepared': {
            const params = new URLSearchParams({ lat, lon });

            if (name) {
                params.set('name', name);
            }

            return `${context.website}location-add?${params}`;
        }

        case 'apple-maps':
            return `https://maps.apple.com/place?coordinate=${lat},${lon}${
                name ? `&name=${label}` : ''
            }`;

        case 'geo-full':
            return name
                ? `geo:${lat},${lon}?q=${lat},${lon}(${label})`
                : `geo:${lat},${lon}?q=${lat},${lon}`;

        case 'geo-basic':
            return `geo:${lat},${lon}`;

        case 'google-maps':
            return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

        case 'decimal-text':
            return `${lat}, ${lon}`;

        case 'display-text':
            return name ? `${name}\n${context.displayText}` : context.displayText;
    }
}

// Links open an app; text is for pasting.
export function isLink(format: ShareFormatId) {
    return format !== 'decimal-text' && format !== 'display-text';
}

// Pulls a name out of an incoming geo: query, which may be a plain name or
// the "lat,lon(Name)" labeled-pin form.
export function nameFromGeoQuery(query: string | null) {
    if (!query) {
        return null;
    }

    const labeled = /^\s*[-+]?\d+(\.\d+)?\s*,\s*[-+]?\d+(\.\d+)?\s*\((.*)\)\s*$/.exec(
        query
    );

    if (labeled) {
        return labeled[3].trim() || null;
    }

    // Bare coordinates are not a name.
    if (/^\s*[-+]?\d+(\.\d+)?\s*,\s*[-+]?\d+(\.\d+)?\s*$/.test(query)) {
        return null;
    }

    return query.trim() || null;
}

// Reads a Be Prepared link's ?lat=&lon=&name= parameters.
export function pointFromParams(search: string): SharePoint | null {
    const params = new URLSearchParams(search);
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));

    if (
        !params.has('lat') ||
        !params.has('lon') ||
        !isFinite(lat) ||
        !isFinite(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
    ) {
        return null;
    }

    return { lat, lon, name: (params.get('name') || '').trim() };
}
