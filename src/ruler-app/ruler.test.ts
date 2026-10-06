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
import test from 'ava';

test('defaultPxPerMm', (t) => {
    t.is(defaultPxPerMm({ coarse: false, shortSide: 1080 }), 96 / 25.4);
    t.is(defaultPxPerMm({ coarse: true, shortSide: 390 }), 160 / 25.4);
    t.is(defaultPxPerMm({ coarse: true, shortSide: 820 }), 132 / 25.4);
});

test('clampPxPerMm', (t) => {
    t.is(clampPxPerMm(0), PX_PER_MM_MIN);
    t.is(clampPxPerMm(100), PX_PER_MM_MAX);
    t.is(clampPxPerMm(NaN), PX_PER_MM_MIN);
    t.is(clampPxPerMm(5), 5);
});

test('cardLengthToPxPerMm', (t) => {
    t.true(Math.abs(cardLengthToPxPerMm(CARD_LONG_MM * 6) - 6) < 1e-9);
    t.is(cardLengthToPxPerMm(1), PX_PER_MM_MIN);
});

test('adjustForPixelRatio', (t) => {
    // Zooming the browser to 200% doubles devicePixelRatio and halves the
    // number of CSS pixels per millimeter.
    t.is(adjustForPixelRatio(6, 2, 4), 3);
    t.is(adjustForPixelRatio(6, 3, 3), 6);
    t.is(adjustForPixelRatio(6, 0, 3), 6);
});

test('nudge', (t) => {
    t.true(Math.abs(nudge(5, 1) - 5.01) < 1e-9);
    t.true(Math.abs(nudge(5, -1) - 4.99) < 1e-9);
    t.is(nudge(PX_PER_MM_MAX, 1), PX_PER_MM_MAX);
});

test('metric ticks at a typical density', (t) => {
    const pxPerMm = 6;
    const ticks = generateTicks(10 * 10 * pxPerMm, pxPerMm, METRIC);
    // 0..100 mm inclusive
    t.is(ticks.length, 101);
    t.deepEqual(ticks[0], { offset: 0, level: 0, label: 0 });
    t.deepEqual(ticks[1], { offset: 6, level: 2, label: null });
    t.deepEqual(ticks[5], { offset: 30, level: 1, label: null });
    t.deepEqual(ticks[10], { offset: 60, level: 0, label: 1 });
    t.deepEqual(ticks[100], { offset: 600, level: 0, label: 10 });
});

test('imperial ticks go down to sixteenths', (t) => {
    const pxPerMm = 6;
    const inchPx = MM_PER_INCH * pxPerMm;
    const ticks = generateTicks(inchPx * 2, pxPerMm, IMPERIAL);
    t.is(ticks.length, 33);
    t.deepEqual(
        ticks.slice(0, 17).map((tick) => tick.level),
        [0, 4, 3, 4, 2, 4, 3, 4, 1, 4, 3, 4, 2, 4, 3, 4, 0]
    );
    t.is(ticks[16].label, 1);
    t.true(Math.abs(ticks[16].offset - inchPx) < 1e-9);
    t.true(Math.abs(ticks[32].offset - inchPx * 2) < 1e-9);
});

test('crowded levels are dropped', (t) => {
    // 2 px/mm: millimeters are too close, sixteenths too.
    const metric = generateTicks(100, 2, METRIC);
    t.deepEqual(
        metric.map((tick) => tick.offset),
        [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    );
    t.deepEqual(
        metric.map((tick) => tick.level),
        [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    );
    const imperial = generateTicks(MM_PER_INCH * 2, 2, IMPERIAL);
    // 50.8 px per inch: 1/16 would be 3.175 px, kept with the default
    // spacing, dropped with a wider one.
    t.is(imperial.length, 17);
    t.is(generateTicks(MM_PER_INCH * 2, 2, IMPERIAL, 4).length, 9);
});

test('ticks stop at the length', (t) => {
    const ticks = generateTicks(59.9, 6, METRIC);
    t.is(ticks[ticks.length - 1].offset, 54);
    t.deepEqual(generateTicks(-1, 6, METRIC), []);
    t.deepEqual(generateTicks(100, 0, METRIC), []);
});

test('formatCm', (t) => {
    t.is(formatCm(0), '0.0 cm');
    t.is(formatCm(123.44), '12.3 cm');
    t.is(formatCm(-5), '0.0 cm');
});

test('formatInches', (t) => {
    t.is(formatInches(0), '0 in');
    t.is(formatInches(MM_PER_INCH), '1 in');
    t.is(formatInches(MM_PER_INCH * 2.5), '2 1/2 in');
    t.is(formatInches(MM_PER_INCH * 0.75), '3/4 in');
    t.is(formatInches(MM_PER_INCH * (4 + 13 / 16)), '4 13/16 in');
    // Rounds to the nearest sixteenth
    t.is(formatInches(MM_PER_INCH * 0.999), '1 in');
});

test('snapToDevice', (t) => {
    t.is(snapToDevice(10.2, 3), 31);
    t.is(snapToDevice(10.5, 2), 21);
});
