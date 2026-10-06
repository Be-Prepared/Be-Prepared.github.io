import {
    flashesPerSecond,
    msUntilToggle,
    SCREEN_HALF_PERIOD_MS,
    strobeOn,
    TORCH_HALF_PERIOD_MS,
} from './strobe';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('strobeOn alternates, starting on', () => {
    assert.ok(strobeOn(0, 100));
    assert.ok(strobeOn(-5, 100));
    assert.ok(strobeOn(99, 100));
    assert.equal(strobeOn(100, 100), false);
    assert.equal(strobeOn(199, 100), false);
    assert.ok(strobeOn(200, 100));
    assert.equal(strobeOn(1150, 100), false);
});

test('msUntilToggle keeps in step', () => {
    assert.equal(msUntilToggle(0, 100), 100);
    assert.equal(msUntilToggle(30, 100), 70);
    // Timer fired late; the next change is still on the beat.
    assert.equal(msUntilToggle(130, 100), 70);
    assert.equal(msUntilToggle(-10, 100), 100);
});

test('screen flashing stays at or under 3 flashes per second', () => {
    assert.ok(flashesPerSecond(SCREEN_HALF_PERIOD_MS) <= 3);
    assert.equal(flashesPerSecond(SCREEN_HALF_PERIOD_MS), 2);
});

test('flashlight strobes 2 to 4 times per second', () => {
    const rate = flashesPerSecond(TORCH_HALF_PERIOD_MS);
    assert.ok(rate >= 2 && rate <= 4);
});
