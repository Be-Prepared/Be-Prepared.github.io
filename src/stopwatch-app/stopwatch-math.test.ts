import {
    currentLapMs,
    elapsed,
    formatStopwatch,
    initialStopwatch,
    isStopwatchState,
    isRunning,
    lap,
    lapRows,
    reset,
    start,
    stop,
} from './stopwatch-math';
import test from 'ava';

test('start, stop and resume use the wall clock', (t) => {
    let state = initialStopwatch();
    t.false(isRunning(state));
    t.is(elapsed(state, 5000), 0);
    state = start(state, 1000);
    t.true(isRunning(state));
    t.is(elapsed(state, 3500), 2500);
    // Starting twice doesn't restart.
    t.is(start(state, 3000), state);
    state = stop(state, 4000);
    t.false(isRunning(state));
    t.is(elapsed(state, 99999), 3000);
    t.is(stop(state, 5000), state);
    state = start(state, 10000);
    t.is(elapsed(state, 10250), 3250);
});

test('elapsed never goes backwards when the clock changes', (t) => {
    const state = start(
        { accumulatedMs: 500, laps: [], startedAt: null },
        10000
    );
    t.is(elapsed(state, 9000), 500);
});

test('laps', (t) => {
    let state = start(initialStopwatch(), 0);
    t.is(lap(initialStopwatch(), 100).laps.length, 0);
    state = lap(state, 1000);
    state = lap(state, 3000);
    state = stop(state, 3500);
    // Laps can't be added while stopped.
    t.is(lap(state, 4000), state);
    t.deepEqual(state.laps, [1000, 3000]);
    t.is(currentLapMs(state, 99999), 500);
    state = start(state, 10000);
    t.is(currentLapMs(state, 10100), 600);
    state = lap(state, 10200);
    t.deepEqual(state.laps, [1000, 3000, 3700]);
    t.is(currentLapMs(state, 10200), 0);
    // Lap totals are truncated to hundredths.
    state = lap(state, 10219);
    t.is(state.laps[3], 3710);
    t.deepEqual(reset(), initialStopwatch());
});

test('lapRows', (t) => {
    t.deepEqual(lapRows([]), []);
    t.deepEqual(lapRows([1000]), [
        { className: 'lap', lapMs: 1000, number: 1, totalMs: 1000 },
    ]);
    t.deepEqual(lapRows([1000, 3000, 3500, 5000]), [
        { className: 'lap', lapMs: 1500, number: 4, totalMs: 5000 },
        { className: 'lap fastest', lapMs: 500, number: 3, totalMs: 3500 },
        { className: 'lap slowest', lapMs: 2000, number: 2, totalMs: 3000 },
        { className: 'lap', lapMs: 1000, number: 1, totalMs: 1000 },
    ]);
    // Ties: the first one found is marked.
    t.deepEqual(
        lapRows([1000, 2000, 4000]).map((row) => row.className),
        ['lap slowest', 'lap', 'lap fastest']
    );
    // All equal: nothing is marked.
    t.deepEqual(
        lapRows([1000, 2000]).map((row) => row.className),
        ['lap', 'lap']
    );
});

test('formatStopwatch', (t) => {
    t.is(formatStopwatch(0), '00:00.00');
    t.is(formatStopwatch(-50), '00:00.00');
    t.is(formatStopwatch(9), '00:00.00');
    t.is(formatStopwatch(10), '00:00.01');
    t.is(formatStopwatch(999), '00:00.99');
    t.is(formatStopwatch(61234), '01:01.23');
    t.is(formatStopwatch(59 * 60000 + 59990), '59:59.99');
    t.is(formatStopwatch(3600000), '1:00:00.00');
    t.is(formatStopwatch(36 * 3600000 + 5 * 60000 + 7890), '36:05:07.89');
});

test('isStopwatchState', (t) => {
    t.true(isStopwatchState(initialStopwatch()));
    t.true(isStopwatchState({ accumulatedMs: 5, laps: [1, 2], startedAt: 9 }));
    t.false(isStopwatchState(null));
    t.false(isStopwatchState('x'));
    t.false(isStopwatchState({ accumulatedMs: -1, laps: [], startedAt: null }));
    t.false(
        isStopwatchState({ accumulatedMs: 0, laps: ['1'], startedAt: null })
    );
    t.false(isStopwatchState({ accumulatedMs: 0, laps: [], startedAt: 'now' }));
    t.false(isStopwatchState({ accumulatedMs: 0, startedAt: null }));
});
