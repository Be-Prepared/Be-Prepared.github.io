import {
    flashesPerSecond,
    msUntilToggle,
    SCREEN_HALF_PERIOD_MS,
    strobeOn,
    TORCH_HALF_PERIOD_MS,
} from './strobe';
import test from 'ava';

test('strobeOn alternates, starting on', (t) => {
    t.true(strobeOn(0, 100));
    t.true(strobeOn(-5, 100));
    t.true(strobeOn(99, 100));
    t.false(strobeOn(100, 100));
    t.false(strobeOn(199, 100));
    t.true(strobeOn(200, 100));
    t.false(strobeOn(1150, 100));
});

test('msUntilToggle keeps in step', (t) => {
    t.is(msUntilToggle(0, 100), 100);
    t.is(msUntilToggle(30, 100), 70);
    // Timer fired late; the next change is still on the beat.
    t.is(msUntilToggle(130, 100), 70);
    t.is(msUntilToggle(-10, 100), 100);
});

test('screen flashing stays at or under 3 flashes per second', (t) => {
    t.true(flashesPerSecond(SCREEN_HALF_PERIOD_MS) <= 3);
    t.is(flashesPerSecond(SCREEN_HALF_PERIOD_MS), 2);
});

test('flashlight strobes 2 to 4 times per second', (t) => {
    const rate = flashesPerSecond(TORCH_HALF_PERIOD_MS);
    t.true(rate >= 2 && rate <= 4);
});
