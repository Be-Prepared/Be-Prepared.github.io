import { CitiesService, City } from './cities.service';
import { CoordinateService } from './coordinate.service';
import { CoordinateSystem } from '../datatypes/coordinate-system';
import { LatLon } from '../datatypes/lat-lon';
import { diOverride } from 'fudgel/dist/di';
import { firstValueFrom, Observable, of } from 'rxjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

class CitiesServiceMock {
    getCityByName(str: string): Observable<City | null> {
        if (str === 'New York City') {
            return of({
                ascii: 'New York City',
                lat: 40.71427,
                lon: -74.00597,
                name: 'New York City',
            });
        }

        if (str.trim().toLowerCase() === 'mountain view') {
            return of({
                ascii: null,
                lat: 37.38605,
                lon: -122.08385,
                name: 'Mountain View',
            });
        }

        return of(null);
    }
}

diOverride(CitiesService, new CitiesServiceMock() as unknown as CitiesService);
const coordinateService = new CoordinateService();

const fromStringScenarios = {
    // City
    'New York City': '40.7142700,-74.0059700',
    'Fake City': null,

    // DDD
    '-42.51687397191149, 172.7156638498528': '-42.5168740,172.7156638',
    '-42.5 172.7': '-42.5000000,172.7000000',
    '-42.5° 172.7°': '-42.5000000,172.7000000',
    'S42.5E172.7': '-42.5000000,172.7000000',

    // DDM
    '46 44.18732, 143 45.50812': '46.7364553,143.7584687',
    'N 46 44.18732 E 143 45.50812': '46.7364553,143.7584687',
    "N 46° 44.18732' W 143° 45.50812'": '46.7364553,-143.7584687',

    // DMS
    '-26 9 9.688, -70 6 6.734': '-26.1526911,-70.1018706',
    's26° 9\' 9.688", w 70° 6\' 6.734"': '-26.1526911,-70.1018706',

    // MGRS
    '21K TQ 16525 52329': '-23.0133256,-59.7656289',
    '18SUJ2337106519': '38.8898005,-77.0365429', // No spaces
    '25X EN 21872 89264': '83.6491652,-31.2286705', // Polar area

    // UTM/UPS
    '08N 434648mE 5571278mN': '50.2900040,-135.9174207', // "Proper" format
    '08N434648 5571278': '50.2900040,-135.9174207',
    '08N E 434648 N 5571278': '50.2900040,-135.9174207',
    'B 2226827 2818270': '-82.3626950,15.4935398', // UPS
    '17N 630084 4833438': '43.6425618,-79.3871429', // Tricky conversion
    '17G 630084 4833438': '-46.6399918,-79.3003131', // Tricky conversion
    '21K 216524 7452328': '-23.0133344,-59.7656388',
    '216525 7452329': null, // Shorthand without a reference
    'G216525 7452329': null, // Shorthand without a reference
    '25X 521873 9289265': '83.6491739,-31.2285870', // Polar area

    // Plus codes
    '849VCWC8+R9': '37.4220625,-122.0840625',
    '849vcwc8+r9x': '37.4221125,-122.0840156',
    '8FVC0000+': '47.5000000,8.5000000', // Padded
    'CWC8+R9 Mountain View': '37.4220625,-122.0840625',
    'cwc8+r9, mountain view': '37.4220625,-122.0840625',
    'CWC8+R9': null, // Short code without a reference
    'CWC8+R9 Fake City': null,
    '+45 +70': '45.0000000,70.0000000', // Degrees, not a plus code

    // Shorthand without a reference
    'UJ 2337 0651': null,
    '2337 0651': null,

    // Unknown
    '': null,
    '.': null,
};

for (const [input, expected] of Object.entries(fromStringScenarios)) {
    test(`fromString: ${input}`, async () => {
        // Await the result so the assertion runs before the test ends.
        const result = await firstValueFrom(coordinateService.fromString(input));
        const actual = result
            ? `${result.lat.toFixed(7)},${result.lon.toFixed(7)}`
            : null;
        assert.equal(actual, expected);
    });
}

test(`bearing`, () => {
    coordinateService.clearCache();
    const bearing = coordinateService.bearing(
        {
            lat: 43.17699373293893,
            lon: -113.53392007855338,
        },
        {
            lat: 41.26164428594633,
            lon: -110.3390909060057,
        }
    );
    assert.equal(bearing.toFixed(7), `129.3247025`);

    const bearing2 = coordinateService.bearing(
        {
            lat: 77.36583699498966,
            lon: -112.04878967571625,
        },
        { lat: 78.55234791058881, lon: -111.80324056660511 }
    );
    assert.equal(bearing2.toFixed(7), '2.5917353');

    const bearing3 = coordinateService.bearing(
        {
            lat: -38.06745199584473,
            lon: 178.22269437196405,
        },
        {
            lat: -43.29553450657438,
            lon: 146.22486843038413,
        }
    );
    assert.equal(bearing3.toFixed(7), '258.3226296');
});

// Shorthand, the reference location, and the full form it should match.
const shorthandScenarios: [string, LatLon, string][] = [
    // MGRS without the grid zone
    ['UJ 2337 0651', { lat: 39.29, lon: -76.61 }, '18S UJ 2337 0651'],
    ['uj23370651', { lat: 39.29, lon: -76.61 }, '18S UJ 2337 0651'],
    ['UJ 23371 06519', { lat: 39.29, lon: -76.61 }, '18SUJ2337106519'],
    // Reference in the neighboring zone 17
    ['UJ 2337 0651', { lat: 38.9, lon: -79.5 }, '18S UJ 2337 0651'],
    // MGRS without the grid zone and 100 km square
    ['2337 0651', { lat: 38.95, lon: -77.1 }, '18S UJ 2337 0651'],
    // Closest match is in the square to the north of the reference
    ['50000 01000', { lat: 39.785, lon: -76.415 }, '18S UK 50000 01000'],
    // Closest match is across the zone boundary from the reference
    ['4070 0993', { lat: 38.9, lon: -78.01 }, '18S TJ 4070 0993'],
    ['3356 4747', { lat: -33.8, lon: 151.1 }, '56H LH 3356 4747'],
    // UTM without the zone number
    ['G 630084 4833438', { lat: -46, lon: -80 }, '17G 630084 4833438'],
    ['630084 4833438', { lat: -46, lon: -80 }, '17G 630084 4833438'],
    ['630084 4833438', { lat: 43, lon: -79 }, '17N 630084 4833438'],
    // Reference in zone 18, closest match in zone 17
    ['630084mE 4833438mN', { lat: 43.6, lon: -77.5 }, '17N 630084 4833438'],
    ['240701 4309930', { lat: 38.9, lon: -78.01 }, '18N 240701 4309930'],
    // Across the antimeridian
    ['300000 5000000', { lat: 45, lon: 179.9 }, '01N 300000 5000000'],
    // Short plus codes
    ['CWC8+R9', { lat: 37.4, lon: -122.1 }, '849VCWC8+R9'],
    ['2222+22', { lat: 89.6, lon: 0 }, 'CFX22222+22'],
    ['XXXXXX+XX', { lat: -81, lon: 0 }, '2CXXXXXX+XX'],
];

for (const [input, reference, full] of shorthandScenarios) {
    test(`fromString with reference: ${input} near ${reference.lat},${reference.lon}`, async () => {
        const expected = await firstValueFrom(coordinateService.fromString(full));
        const actual = await firstValueFrom(
            coordinateService.fromString(input, reference)
        );
        assert.ok(expected);
        assert.ok(actual);
        assert.equal(actual.lat.toFixed(7), expected.lat.toFixed(7));
        assert.equal(actual.lon.toFixed(7), expected.lon.toFixed(7));
    });
}

test('fromString with reference: unusable shorthand', async () => {
    const near = { lat: 39.29, lon: -76.61 };
    const parse = (str: string, reference: LatLon) =>
        firstValueFrom(coordinateService.fromString(str, reference));

    // Easting and northing need the same number of digits
    assert.equal(await parse('UJ 233 0651', near), null);
    assert.equal(await parse('UJ 2330651', near), null);
    // No UTM grid near the poles
    assert.equal(await parse('UJ 2337 0651', { lat: 88, lon: 0 }), null);
    // Full coordinates ignore the reference
    const full = await parse('21K TQ 16525 52329', near);
    assert.equal(full && full.lat.toFixed(7), '-23.0133256');
});

test('needsReference', () => {
    for (const str of [
        'UJ 2337 0651',
        'UJ23370651',
        '2337 0651',
        'J 123456 1234567',
        '123456 1234567',
        '123456mE 1234567mN',
        'CWC8+R9',
    ]) {
        assert.equal(coordinateService.needsReference(str), true, str);
    }

    for (const str of [
        'CWC8+R9 Mountain View',
        '849VCWC8+R9',
        '18S UJ 2337 0651',
        '17T 582561 4478883',
        'B 2226827 2818270',
        'Paris',
        '40.5 -70.2',
    ]) {
        assert.equal(coordinateService.needsReference(str), false, str);
    }
});

test('latLonToSystemString: plus code', () => {
    coordinateService['_currentSetting'].next(CoordinateSystem.PLUSCODE);

    try {
        assert.equal(
            coordinateService.latLonToSystemString(37.4221125, -122.0840156),
            '849VCWC8+R9X'
        );
        assert.deepEqual(coordinateService.latLonToSystem(47.0000625, 8.0000625), {
            pluscode: '8FVC2222+22G',
        });
    } finally {
        coordinateService['_currentSetting'].next(CoordinateSystem.DMS);
    }
});

// Rounding must carry into the next unit instead of showing 60.
test('DMS rounds seconds up into the next minute', () => {
    coordinateService.setCoordinateSystem(CoordinateSystem.DMS);
    const text = coordinateService.latLonToSystemString(
        39.99999,
        -104.99999
    );
    assert.equal(text.includes('60'), false, text);
    assert.match(text, /N 40° 00' 00\.0"/);
    assert.match(text, /W 105° 00' 00\.0"/);
});

test('DDM rounds minutes up into the next degree', () => {
    coordinateService.setCoordinateSystem(CoordinateSystem.DDM);
    const text = coordinateService.latLonToSystemString(
        12.9999999,
        -0.0000001
    );
    assert.match(text, /N 13° 00\.000'/);
    assert.equal(text.includes('60.000'), false, text);
});

test('DMS keeps ordinary values', () => {
    coordinateService.setCoordinateSystem(CoordinateSystem.DMS);
    const text = coordinateService.latLonToSystemString(
        -26.1526911,
        -70.1018706
    );
    assert.match(text, /S 26° 09' 09\.7"/);
    assert.match(text, /W 70° 06' 06\.7"/);
});

// usng.js throws outside 80° S to 84° N and right next to the poles.
test('MGRS falls back to UPS in the polar regions', async () => {
    coordinateService['_currentSetting'].next(CoordinateSystem.MGRS);

    try {
        assert.equal(
            coordinateService.latLonToSystemString(85, 10),
            'Z 2096454mE 1452983mN'
        );
        assert.equal(
            coordinateService.latLonToSystemString(-85, 10),
            'B 2096454mE 2547017mN'
        );
        assert.deepEqual(
            coordinateService.latLonToSystem(89.99999, 179.99999),
            {
                zone: 'Z',
                easting: '2000000mE',
                northing: '2000001mN',
                utmups: 'Z 2000000mE 2000001mN',
            }
        );
        assert.match(
            coordinateService.latLonToSystemString(-89.99999, -179.99999),
            /^A /
        );

        // The fallback text parses back to the same place.
        const parsed = await firstValueFrom(
            coordinateService.fromString('Z 2096454mE 1452983mN')
        );
        assert.ok(parsed);
        assert.ok(Math.abs(parsed.lat - 85) < 0.0001, `${parsed.lat}`);
        assert.ok(Math.abs(parsed.lon - 10) < 0.0001, `${parsed.lon}`);

        // Ordinary places still use MGRS.
        assert.equal(
            coordinateService.latLonToSystemString(38.8898005, -77.0365429),
            '18S UJ 23371 06519'
        );
    } finally {
        coordinateService['_currentSetting'].next(CoordinateSystem.DMS);
    }
});
