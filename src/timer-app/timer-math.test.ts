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
import test from 'ava';

test('clampDuration', (t) => {
    t.is(clampDuration(-5), 0);
    t.is(clampDuration(NaN), 0);
    t.is(clampDuration(1499), 1000);
    t.is(clampDuration(1500), 2000);
    t.is(clampDuration(1e12), MAX_DURATION_MS);
    t.is(MAX_DURATION_MS, (99 * 3600 + 59 * 60 + 59) * 1000);
});

test('runs on the wall clock', (t) => {
    let state = initialTimer(60000);
    t.is(remainingMs(state, 0), 60000);
    t.is(progress(state, 0), 1);
    state = start(state, 1000);
    t.is(state.status, 'running');
    t.is(state.endAt, 61000);
    t.is(remainingMs(state, 31000), 30000);
    t.is(progress(state, 31000), 0.5);
    t.false(isFinished(state, 60999));
    t.true(isFinished(state, 61000));
    // Long after the end, e.g. when the page was in the background.
    t.is(remainingMs(state, 999999), 0);
    t.is(progress(state, 999999), 0);
    t.true(isFinished(state, 999999));
});

test('pause and resume', (t) => {
    let state = start(initialTimer(10000), 0);
    state = pause(state, 4000);
    t.is(state.status, 'paused');
    t.is(remainingMs(state, 50000), 6000);
    t.false(isFinished(state, 50000));
    // Pausing again does nothing.
    t.is(pause(state, 60000), state);
    state = resume(state, 100000);
    t.is(state.status, 'running');
    t.is(state.endAt, 106000);
    t.is(remainingMs(state, 101000), 5000);
    t.is(resume(state, 0), state);
});

test('finish and reset keep the duration', (t) => {
    let state = start(initialTimer(3000), 0);
    state = finish(state);
    t.is(state.status, 'done');
    t.is(remainingMs(state, 0), 0);
    t.false(isFinished(state, 99999));
    state = reset(state);
    t.deepEqual(state, initialTimer(3000));
});

test('start and setDuration only from idle', (t) => {
    t.is(start(initialTimer(0), 0).status, 'idle');
    const running = start(initialTimer(5000), 0);
    t.is(start(running, 100), running);
    t.is(setDuration(running, 1000), running);
    t.is(setDuration(initialTimer(), 61500).durationMs, 62000);
});

test('splitDuration and joinDuration', (t) => {
    t.deepEqual(splitDuration(0), { h: 0, m: 0, s: 0 });
    t.deepEqual(splitDuration(3723000), { h: 1, m: 2, s: 3 });
    t.deepEqual(splitDuration(-1), { h: 0, m: 0, s: 0 });
    t.is(joinDuration(1, 2, 3), 3723000);
});

test('stepUnit wraps within the unit', (t) => {
    t.is(stepUnit(0, 'm', 1), 60000);
    t.is(stepUnit(joinDuration(0, 59, 0), 'm', 1), 0);
    t.is(stepUnit(0, 's', -1), 59000);
    t.is(stepUnit(joinDuration(1, 0, 30), 's', 1), joinDuration(1, 0, 31));
    t.is(stepUnit(0, 'h', -1), joinDuration(99, 0, 0));
    t.is(stepUnit(joinDuration(99, 5, 0), 'h', 1), joinDuration(0, 5, 0));
});

test('formatTimer rounds up to whole seconds', (t) => {
    t.is(formatTimer(0), '0:00');
    t.is(formatTimer(-100), '0:00');
    t.is(formatTimer(1), '0:01');
    t.is(formatTimer(1000), '0:01');
    t.is(formatTimer(1001), '0:02');
    t.is(formatTimer(59999), '1:00');
    t.is(formatTimer(5 * 60000), '5:00');
    t.is(formatTimer(joinDuration(0, 59, 59)), '59:59');
    t.is(formatTimer(joinDuration(1, 0, 0)), '1:00:00');
    t.is(formatTimer(joinDuration(12, 3, 4)), '12:03:04');
});

test('isTimerState', (t) => {
    t.true(isTimerState(initialTimer()));
    t.true(isTimerState(start(initialTimer(), 5)));
    t.true(isTimerState(pause(start(initialTimer(), 5), 10)));
    t.true(isTimerState(finish(initialTimer())));
    t.false(isTimerState(null));
    t.false(isTimerState({ ...initialTimer(), status: 'nope' }));
    t.false(isTimerState({ ...initialTimer(), status: 'running' }));
    t.false(isTimerState({ ...initialTimer(), durationMs: -1 }));
    t.false(isTimerState({ ...initialTimer(), endAt: 5 }));
});
