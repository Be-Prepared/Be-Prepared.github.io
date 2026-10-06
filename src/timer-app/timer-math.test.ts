import {
    clampDuration,
    finish,
    formatTimer,
    initialTimer,
    isFinished,
    isTimerState,
    joinDuration,
    MAX_DURATION_MS,
    pause,
    progress,
    remainingMs,
    reset,
    resume,
    setDuration,
    splitDuration,
    start,
    stepUnit,
} from './timer-math';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('clampDuration', () => {
    assert.equal(clampDuration(-5), 0);
    assert.equal(clampDuration(NaN), 0);
    assert.equal(clampDuration(1499), 1000);
    assert.equal(clampDuration(1500), 2000);
    assert.equal(clampDuration(1e12), MAX_DURATION_MS);
    assert.equal(MAX_DURATION_MS, (99 * 3600 + 59 * 60 + 59) * 1000);
});

test('runs on the wall clock', () => {
    let state = initialTimer(60000);
    assert.equal(remainingMs(state, 0), 60000);
    assert.equal(progress(state, 0), 1);
    state = start(state, 1000);
    assert.equal(state.status, 'running');
    assert.equal(state.endAt, 61000);
    assert.equal(remainingMs(state, 31000), 30000);
    assert.equal(progress(state, 31000), 0.5);
    assert.equal(isFinished(state, 60999), false);
    assert.ok(isFinished(state, 61000));
    // Long after the end, e.g. when the page was in the background.
    assert.equal(remainingMs(state, 999999), 0);
    assert.equal(progress(state, 999999), 0);
    assert.ok(isFinished(state, 999999));
});

test('pause and resume', () => {
    let state = start(initialTimer(10000), 0);
    state = pause(state, 4000);
    assert.equal(state.status, 'paused');
    assert.equal(remainingMs(state, 50000), 6000);
    assert.equal(isFinished(state, 50000), false);
    // Pausing again does nothing.
    assert.equal(pause(state, 60000), state);
    state = resume(state, 100000);
    assert.equal(state.status, 'running');
    assert.equal(state.endAt, 106000);
    assert.equal(remainingMs(state, 101000), 5000);
    assert.equal(resume(state, 0), state);
});

test('finish and reset keep the duration', () => {
    let state = start(initialTimer(3000), 0);
    state = finish(state);
    assert.equal(state.status, 'done');
    assert.equal(remainingMs(state, 0), 0);
    assert.equal(isFinished(state, 99999), false);
    state = reset(state);
    assert.deepEqual(state, initialTimer(3000));
});

test('start and setDuration only from idle', () => {
    assert.equal(start(initialTimer(0), 0).status, 'idle');
    const running = start(initialTimer(5000), 0);
    assert.equal(start(running, 100), running);
    assert.equal(setDuration(running, 1000), running);
    assert.equal(setDuration(initialTimer(), 61500).durationMs, 62000);
});

test('splitDuration and joinDuration', () => {
    assert.deepEqual(splitDuration(0), { h: 0, m: 0, s: 0 });
    assert.deepEqual(splitDuration(3723000), { h: 1, m: 2, s: 3 });
    assert.deepEqual(splitDuration(-1), { h: 0, m: 0, s: 0 });
    assert.equal(joinDuration(1, 2, 3), 3723000);
});

test('stepUnit wraps within the unit', () => {
    assert.equal(stepUnit(0, 'm', 1), 60000);
    assert.equal(stepUnit(joinDuration(0, 59, 0), 'm', 1), 0);
    assert.equal(stepUnit(0, 's', -1), 59000);
    assert.equal(stepUnit(joinDuration(1, 0, 30), 's', 1), joinDuration(1, 0, 31));
    assert.equal(stepUnit(0, 'h', -1), joinDuration(99, 0, 0));
    assert.equal(stepUnit(joinDuration(99, 5, 0), 'h', 1), joinDuration(0, 5, 0));
});

test('formatTimer rounds up to whole seconds', () => {
    assert.equal(formatTimer(0), '0:00');
    assert.equal(formatTimer(-100), '0:00');
    assert.equal(formatTimer(1), '0:01');
    assert.equal(formatTimer(1000), '0:01');
    assert.equal(formatTimer(1001), '0:02');
    assert.equal(formatTimer(59999), '1:00');
    assert.equal(formatTimer(5 * 60000), '5:00');
    assert.equal(formatTimer(joinDuration(0, 59, 59)), '59:59');
    assert.equal(formatTimer(joinDuration(1, 0, 0)), '1:00:00');
    assert.equal(formatTimer(joinDuration(12, 3, 4)), '12:03:04');
});

test('isTimerState', () => {
    assert.ok(isTimerState(initialTimer()));
    assert.ok(isTimerState(start(initialTimer(), 5)));
    assert.ok(isTimerState(pause(start(initialTimer(), 5), 10)));
    assert.ok(isTimerState(finish(initialTimer())));
    assert.equal(isTimerState(null), false);
    assert.equal(isTimerState({ ...initialTimer(), status: 'nope' }), false);
    assert.equal(isTimerState({ ...initialTimer(), status: 'running' }), false);
    assert.equal(isTimerState({ ...initialTimer(), durationMs: -1 }), false);
    assert.equal(isTimerState({ ...initialTimer(), endAt: 5 }), false);
});
