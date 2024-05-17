import { CoordinateService } from './coordinate.service';
import test from 'ava';

const coordinateService = new CoordinateService();

const fromStringScenarios = {
    // City
    'New York City': '40.7142700,-74.0059700',

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
        const result = coordinateService.fromString(scenario[0]);

        if (result) {
            const lat = result.lat.toFixed(7);
            const lon = result.lon.toFixed(7);
            t.is<string | null, string | null>(`${lat},${lon}`, scenario[1]);
        } else {
            t.is<string | null, string | null>(result, scenario[1]);
        }
    });
}
