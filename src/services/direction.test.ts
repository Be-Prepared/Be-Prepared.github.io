import { DirectionService } from './direction.service';
import test from 'ava';

const directionService = new DirectionService();

const NORTH = 0;
const EAST = 90;
const SOUTH = 180;
const WEST = 270;

const radiansToDegreesNWScenarios = [
    { radians: 0, expected: NORTH },
    { radians: 0.5 * Math.PI, expected: WEST },
    { radians: Math.PI, expected: SOUTH },
    { radians: 1.5 * Math.PI, expected: EAST },
];

for (const scenario of radiansToDegreesNWScenarios) {
    test(`radiansToDegreesNW: ${scenario.radians}`, (t) => {
        t.is(directionService.radiansToDegreesNW(scenario.radians), scenario.expected);
    });
}

const radiansToDegreesSWScenarios = [
    { radians: 0, expected: SOUTH },
    { radians: 0.5 * Math.PI, expected: WEST },
    { radians: Math.PI, expected: NORTH },
    { radians: 1.5 * Math.PI, expected: EAST },
];

for (const scenario of radiansToDegreesSWScenarios) {
    test(`radiansToDegreesSW: ${scenario.radians}`, (t) => {
        t.is(directionService.radiansToDegreesSW(scenario.radians), scenario.expected);
    });
}

const standardize180Scenarios = [
    { degrees: -190, expected: 170 },
    { degrees: -180, expected: -180 },
    { degrees: -100, expected: -100 },
    { degrees: 0, expected: 0 },
    { degrees: 18, expected: 18 },
    { degrees: 179.9, expected: 179.9 },
    { degrees: 180, expected: -180 },
    { degrees: 359, expected: -1 },
];

for (const scenario of standardize180Scenarios) {
    test(`standardize180: ${scenario.degrees}`, (t) => {
        t.is(directionService.standardize180(scenario.degrees), scenario.expected);
    });
}

const standardize360Scenarios = [
    { degrees: -360, expected: 0 },
    { degrees: -190, expected: 170 },
    { degrees: -180, expected: 180 },
    { degrees: 180, expected: 180 },
    { degrees: 0, expected: 0 },
    { degrees: 360, expected: 0 },
    { degrees: 540, expected: 180 },
    { degrees: -540, expected: 180 },
];

for (const scenario of standardize360Scenarios) {
    test(`standardize360: ${scenario.degrees}`, (t) => {
        t.is(directionService.standardize360(scenario.degrees), scenario.expected);
    });
}

const standardizeLatitudeScenarios = [
    { latitude: -100, expected: -80 },
    { latitude: -90, expected: -90 },
    { latitude: -80, expected: -80 },
    { latitude: 0, expected: 0 },
    { latitude: 80, expected: 80 },
    { latitude: 90, expected: 90 },
    { latitude: 100, expected: 80 },
];

for (const scenario of standardizeLatitudeScenarios) {
    test(`standardizeLatitude: ${scenario.latitude}`, (t) => {
        t.is(directionService.standardizeLatitude(scenario.latitude), scenario.expected);
    });
}

const toCompassPointScenarios = [
    { degrees: NORTH, expected: 'N' },
    { degrees: EAST, expected: 'E' },
    { degrees: SOUTH, expected: 'S' },
    { degrees: WEST, expected: 'W' },
];

for (const scenario of toCompassPointScenarios) {
    test(`toCompassPoint: ${scenario.degrees}`, (t) => {
        t.is(directionService.toCompassPoint(scenario.degrees), scenario.expected);
    });
}
