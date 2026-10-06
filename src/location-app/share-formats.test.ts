import {
    buildShare,
    formatDecimal,
    nameFromGeoQuery,
    pointFromParams,
    SHARE_FORMATS,
} from './share-formats';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const point = { lat: 38.8894838, lon: -77.0352791, name: 'Washington Monument' };
const context = {
    displayText: `N 38° 53' 22.1" W 77° 02' 07.0"`,
    website: 'https://be-prepared.github.io/',
};

test('formatDecimal trims and limits precision', () => {
    assert.equal(formatDecimal(38.88948381234), '38.8894838');
    assert.equal(formatDecimal(-77), '-77');
    assert.equal(formatDecimal(0.5), '0.5');
});

test('Be Prepared link round-trips through its parameters', () => {
    const url = new URL(buildShare('be-prepared', point, context));
    assert.equal(url.origin + url.pathname, 'https://be-prepared.github.io/location-add');
    assert.deepEqual(pointFromParams(url.search), point);
});

test('Apple Maps link carries coordinates and the name', () => {
    assert.equal(
        buildShare('apple-maps', point, context),
        'https://maps.apple.com/place?coordinate=38.8894838,-77.0352791&name=Washington%20Monument'
    );
});

test('Apple Maps is listed just before the text options', () => {
    const appleIndex = SHARE_FORMATS.indexOf('apple-maps');
    assert.equal(SHARE_FORMATS[appleIndex + 1], 'decimal-text');
});

test('full geo link uses the labeled-pin form', () => {
    assert.equal(
        buildShare('geo-full', point, context),
        'geo:38.8894838,-77.0352791?q=38.8894838,-77.0352791(Washington%20Monument)'
    );
});

test('parentheses in names are escaped in geo links', () => {
    const url = buildShare('geo-full', { ...point, name: 'Camp (north)' }, context);
    assert.match(url, /\(Camp%20%28north%29\)$/);
});

test('compatible geo link is only coordinates', () => {
    assert.equal(buildShare('geo-basic', point, context), 'geo:38.8894838,-77.0352791');
});

test('links without a name leave the label out', () => {
    const unnamed = { ...point, name: '  ' };
    assert.equal(
        buildShare('apple-maps', unnamed, context),
        'https://maps.apple.com/place?coordinate=38.8894838,-77.0352791'
    );
    assert.equal(
        buildShare('geo-full', unnamed, context),
        'geo:38.8894838,-77.0352791?q=38.8894838,-77.0352791'
    );
    assert.equal(
        pointFromParams(new URL(buildShare('be-prepared', unnamed, context)).search)?.name,
        ''
    );
});

test('text formats', () => {
    assert.equal(buildShare('decimal-text', point, context), '38.8894838, -77.0352791');
    assert.equal(
        buildShare('display-text', point, context),
        `Washington Monument\n${context.displayText}`
    );
});

test('every format builds something', () => {
    for (const format of SHARE_FORMATS) {
        assert.ok(buildShare(format, point, context).length > 0, format);
    }
});

test('nameFromGeoQuery', () => {
    assert.equal(nameFromGeoQuery('Washington Monument'), 'Washington Monument');
    assert.equal(nameFromGeoQuery('38.88,-77.03(Washington Monument)'), 'Washington Monument');
    assert.equal(nameFromGeoQuery('38.88,-77.03'), null);
    assert.equal(nameFromGeoQuery('38.88,-77.03()'), null);
    assert.equal(nameFromGeoQuery(''), null);
    assert.equal(nameFromGeoQuery(null), null);
});

test('pointFromParams rejects bad input', () => {
    assert.equal(pointFromParams('?lat=1'), null);
    assert.equal(pointFromParams('?lat=91&lon=0'), null);
    assert.equal(pointFromParams('?lat=abc&lon=0'), null);
    assert.deepEqual(pointFromParams('?lat=-1.5&lon=2'), { lat: -1.5, lon: 2, name: '' });
});
