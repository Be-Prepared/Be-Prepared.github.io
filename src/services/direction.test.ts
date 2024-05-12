import { DirectionService } from './direction.service';
import test from 'ava';

const directionService = new DirectionService();

const NORTH = 0;
const EAST = 90;
const SOUTH = 180;
const WEST = 270;

test('radiansToDegreesNW', (t) => {
    // Starts at north and goes counter-clockwise
    t.is(directionService.radiansToDegreesNW(0), NORTH);
    t.is(directionService.radiansToDegreesNW(0.5 * Math.PI), WEST);
    t.is(directionService.radiansToDegreesNW(Math.PI), SOUTH);
    t.is(directionService.radiansToDegreesNW(1.5 * Math.PI), EAST);
});

test('radiansToDegreesSW', (t) => {
    // Starts at south and goes clockwise
    t.is(directionService.radiansToDegreesSW(0), SOUTH);
    t.is(directionService.radiansToDegreesSW(0.5 * Math.PI), WEST);
    t.is(directionService.radiansToDegreesSW(Math.PI), NORTH);
    t.is(directionService.radiansToDegreesSW(1.5 * Math.PI), EAST);
});

test('standardize180', (t) => {
    t.is(directionService.standardize180(-190), 170);
    t.is(directionService.standardize180(-180), -180);
    t.is(directionService.standardize180(-100), -100);
    t.is(directionService.standardize180(0), 0);
    t.is(directionService.standardize180(18), 18);
    t.is(directionService.standardize180(179.9), 179.9);
    t.is(directionService.standardize180(180), -180);
    t.is(directionService.standardize180(359), -1);
});

test('standardize360', (t) => {
    t.is(directionService.standardize360(-360), 0);
    t.is(directionService.standardize360(-190), 170);
    t.is(directionService.standardize360(-180), 180);
    t.is(directionService.standardize360(180), 180);
    t.is(directionService.standardize360(0), 0);
    t.is(directionService.standardize360(360), 0);
    t.is(directionService.standardize360(540), 180);
    t.is(directionService.standardize360(-540), 180);
});

test('standardizeLatitude', (t) => {
    t.is(directionService.standardizeLatitude(-100), -80);
    t.is(directionService.standardizeLatitude(-90), -90);
    t.is(directionService.standardizeLatitude(-80), -80);
    t.is(directionService.standardizeLatitude(0), 0);
    t.is(directionService.standardizeLatitude(80), 80);
    t.is(directionService.standardizeLatitude(90), 90);
    t.is(directionService.standardizeLatitude(100), 80);
});

test('toCompassPoint', (t) => {
    t.is(directionService.toCompassPoint(NORTH), 'N');
    t.is(directionService.toCompassPoint(EAST), 'E');
    t.is(directionService.toCompassPoint(SOUTH), 'S');
    t.is(directionService.toCompassPoint(WEST), 'W');
});
