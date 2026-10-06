import {
    adjustForPixelRatio,
    CARD_LONG_MM,
    cardLengthToPxPerMm,
    clampPxPerMm,
    defaultPxPerMm,
    formatCm,
    formatInches,
    generateTicks,
    IMPERIAL,
    METRIC,
    MM_PER_INCH,
    nudge,
    PX_PER_MM_MAX,
    PX_PER_MM_MIN,
    snapToDevice,
} from './ruler';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('defaultPxPerMm', () => {
    assert.equal(defaultPxPerMm({ coarse: false, shortSide: 1080 }), 96 / 25.4);
    assert.equal(defaultPxPerMm({ coarse: true, shortSide: 390 }), 160 / 25.4);
    assert.equal(defaultPxPerMm({ coarse: true, shortSide: 820 }), 132 / 25.4);
});

test('clampPxPerMm', () => {
    assert.equal(clampPxPerMm(0), PX_PER_MM_MIN);
    assert.equal(clampPxPerMm(100), PX_PER_MM_MAX);
    assert.equal(clampPxPerMm(NaN), PX_PER_MM_MIN);
    assert.equal(clampPxPerMm(5), 5);
});

test('cardLengthToPxPerMm', () => {
    assert.ok(Math.abs(cardLengthToPxPerMm(CARD_LONG_MM * 6) - 6) < 1e-9);
    assert.equal(cardLengthToPxPerMm(1), PX_PER_MM_MIN);
});

test('adjustForPixelRatio', () => {
    // Zooming the browser to 200% doubles devicePixelRatio and halves the
    // number of CSS pixels per millimeter.
    assert.equal(adjustForPixelRatio(6, 2, 4), 3);
    assert.equal(adjustForPixelRatio(6, 3, 3), 6);
    assert.equal(adjustForPixelRatio(6, 0, 3), 6);
});

test('nudge', () => {
    assert.ok(Math.abs(nudge(5, 1) - 5.01) < 1e-9);
    assert.ok(Math.abs(nudge(5, -1) - 4.99) < 1e-9);
    assert.equal(nudge(PX_PER_MM_MAX, 1), PX_PER_MM_MAX);
});

test('metric ticks at a typical density', () => {
    const pxPerMm = 6;
    const ticks = generateTicks(10 * 10 * pxPerMm, pxPerMm, METRIC);
    // 0..100 mm inclusive
    assert.equal(ticks.length, 101);
    assert.deepEqual(ticks[0], { offset: 0, level: 0, label: 0 });
    assert.deepEqual(ticks[1], { offset: 6, level: 2, label: null });
    assert.deepEqual(ticks[5], { offset: 30, level: 1, label: null });
    assert.deepEqual(ticks[10], { offset: 60, level: 0, label: 1 });
    assert.deepEqual(ticks[100], { offset: 600, level: 0, label: 10 });
});

test('imperial ticks go down to sixteenths', () => {
    const pxPerMm = 6;
    const inchPx = MM_PER_INCH * pxPerMm;
    const ticks = generateTicks(inchPx * 2, pxPerMm, IMPERIAL);
    assert.equal(ticks.length, 33);
    assert.deepEqual(
        ticks.slice(0, 17).map((tick) => tick.level),
        [0, 4, 3, 4, 2, 4, 3, 4, 1, 4, 3, 4, 2, 4, 3, 4, 0]
    );
    assert.equal(ticks[16].label, 1);
    assert.ok(Math.abs(ticks[16].offset - inchPx) < 1e-9);
    assert.ok(Math.abs(ticks[32].offset - inchPx * 2) < 1e-9);
});

test('crowded levels are dropped', () => {
    // 2 px/mm: millimeters are too close, sixteenths too.
    const metric = generateTicks(100, 2, METRIC);
    assert.deepEqual(
        metric.map((tick) => tick.offset),
        [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    );
    assert.deepEqual(
        metric.map((tick) => tick.level),
        [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    );
    const imperial = generateTicks(MM_PER_INCH * 2, 2, IMPERIAL);
    // 50.8 px per inch: 1/16 would be 3.175 px, kept with the default
    // spacing, dropped with a wider one.
    assert.equal(imperial.length, 17);
    assert.equal(generateTicks(MM_PER_INCH * 2, 2, IMPERIAL, 4).length, 9);
});

test('ticks stop at the length', () => {
    const ticks = generateTicks(59.9, 6, METRIC);
    assert.equal(ticks[ticks.length - 1].offset, 54);
    assert.deepEqual(generateTicks(-1, 6, METRIC), []);
    assert.deepEqual(generateTicks(100, 0, METRIC), []);
});

test('formatCm', () => {
    assert.equal(formatCm(0), '0.0 cm');
    assert.equal(formatCm(123.44), '12.3 cm');
    assert.equal(formatCm(-5), '0.0 cm');
});

test('formatInches', () => {
    assert.equal(formatInches(0), '0 in');
    assert.equal(formatInches(MM_PER_INCH), '1 in');
    assert.equal(formatInches(MM_PER_INCH * 2.5), '2 1/2 in');
    assert.equal(formatInches(MM_PER_INCH * 0.75), '3/4 in');
    assert.equal(formatInches(MM_PER_INCH * (4 + 13 / 16)), '4 13/16 in');
    // Rounds to the nearest sixteenth
    assert.equal(formatInches(MM_PER_INCH * 0.999), '1 in');
});

test('snapToDevice', () => {
    assert.equal(snapToDevice(10.2, 3), 31);
    assert.equal(snapToDevice(10.5, 2), 21);
});
