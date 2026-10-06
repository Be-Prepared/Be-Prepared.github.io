import assert from 'node:assert/strict';
import { parseGeoUri } from './geo-uri';
import { test } from 'node:test';

const scenarios: [string, string, ReturnType<typeof parseGeoUri>][] = [
    // From the manifest protocol handler.
    [
        'web%2Bgeo%3A37.786971%2C-122.399677',
        '',
        { lat: 37.786971, lon: -122.399677, name: null },
    ],
    [
        'geo%3A37.786971%2C-122.399677',
        '',
        { lat: 37.786971, lon: -122.399677, name: null },
    ],
    [
        'geo%3A0%2C0%3Fq%3D37.78%2C-122.39(Coffee%2520%2526%2520Tea)',
        '',
        { lat: 37.78, lon: -122.39, name: 'Coffee & Tea' },
    ],
    // Plain URIs.
    ['geo:37.786971,-122.399677', '', { lat: 37.786971, lon: -122.399677, name: null }],
    ['GEO:37.786971,-122.399677', '', { lat: 37.786971, lon: -122.399677, name: null }],
    ['web+geo:37.786971,-122.399677', '', { lat: 37.786971, lon: -122.399677, name: null }],
    // RFC 5870 altitude and parameters.
    ['geo:37.786971,-122.399677;u=35', '', { lat: 37.786971, lon: -122.399677, name: null }],
    ['geo:37.786971,-122.399677;crs=wgs84;u=35', '', { lat: 37.786971, lon: -122.399677, name: null }],
    ['geo:37.786971,-122.399677,10', '', { lat: 37.786971, lon: -122.399677, name: null }],
    // Android.
    ['geo:0,0?q=37.78,-122.39(Name)', '', { lat: 37.78, lon: -122.39, name: 'Name' }],
    ['geo:0,0?q=37.78,-122.39', '', { lat: 37.78, lon: -122.39, name: null }],
    ['geo:37.78,-122.39?q=Home', '', { lat: 37.78, lon: -122.39, name: 'Home' }],
    ['geo:0,0?q=1600+Amphitheatre+Parkway', '', null],
    ['geo:0,0', '', { lat: 0, lon: 0, name: null }],
    // From styled-link before it encoded the URI: the query is on the page.
    ['37.78,-122.39', '?q=37.78,-122.39(Pin)', { lat: 37.78, lon: -122.39, name: 'Pin' }],
    ['0,0', '?q=37.78,-122.39(Pin)', { lat: 37.78, lon: -122.39, name: 'Pin' }],
    ['37.78,-122.39', '?z=3?q=Name', { lat: 37.78, lon: -122.39, name: 'Name' }],
    // The URI's own query wins.
    ['geo:1,2?q=Inner', '?q=Outer', { lat: 1, lon: 2, name: 'Inner' }],
    // Garbage.
    ['', '', null],
    ['geo:', '', null],
    ['geo:91,0', '', null],
    ['geo:0,181', '', null],
    ['geo:abc,def', '', null],
    ['geo:1', '', null],
    ['geo:1,2,3,4', '', null],
    ['web%2Bgeo%3A%E0%A4%A', '', null],
];

for (const [input, search, expected] of scenarios) {
    test(`parseGeoUri: ${input} ${search}`, () => {
        assert.deepEqual(parseGeoUri(input, search), expected);
    });
}
