import { CitiesService, City } from './cities.service';
import { CoordinateService } from './coordinate.service';
import { diOverride } from 'fudgel/dist/di';
import { Observable, of } from 'rxjs';
import test from 'ava';

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
    '216525 7452329': null, // Possible future shorthand
    'G216525 7452329': null, // Possible future shorthand
    '25X 521873 9289265': '83.6491739,-31.2285870', // Polar area

    // Unknown
    '': null,
    '.': null,
};

for (const scenario of Object.entries(fromStringScenarios)) {
    test(`fromString: ${scenario[0]}`, (t) => {
        coordinateService.fromString(scenario[0]).subscribe(
            (result) => {
                if (result) {
                    const lat = result.lat.toFixed(7);
                    const lon = result.lon.toFixed(7);
                    t.is<string | null, string | null>(
                        `${lat},${lon}`,
                        scenario[1]
                    );
                } else {
                    t.is<string | null, string | null>(result, scenario[1]);
                }
            },
            (error) => {
                t.fail(error);
            }
        );
    });
}

test(`bearing`, (t) => {
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
    t.is(bearing.toFixed(7), `129.3233098`);

    const bearing2 = coordinateService.bearing(
        {
            lat: 77.36583699498966,
            lon: -112.04878967571625,
        },
        { lat: 78.55234791058881, lon: -111.80324056660511 }
    );
    t.is(bearing2.toFixed(7), '2.5925751');

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
    t.is(bearing3.toFixed(7), '258.3230285');
});
