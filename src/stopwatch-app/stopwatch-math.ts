// Stopwatch state and math. Times come from the wall clock (Date.now) so the
// stopwatch stays right when the browser throttles or pauses timers in the
// background.

export interface StopwatchState {
    // Time accumulated before the current run started.
    accumulatedMs: number;
    // Total elapsed time at each lap press, oldest first.
    laps: number[];
    // When the current run started, or null when stopped.
    startedAt: number | null;
}

export interface LapRow {
    className: string;
    lapMs: number;
    number: number;
    totalMs: number;
}

export function initialStopwatch(): StopwatchState {
    return { accumulatedMs: 0, laps: [], startedAt: null };
}

export function isRunning(state: StopwatchState) {
    return state.startedAt !== null;
}

export function elapsed(state: StopwatchState, now: number) {
    if (state.startedAt === null) {
        return state.accumulatedMs;
    }

    // The clock can be set backwards; never go below what's already counted.
    return state.accumulatedMs + Math.max(0, now - state.startedAt);
}

export function start(state: StopwatchState, now: number): StopwatchState {
    if (state.startedAt !== null) {
        return state;
    }

    return { ...state, startedAt: now };
}

export function stop(state: StopwatchState, now: number): StopwatchState {
    if (state.startedAt === null) {
        return state;
    }

    return {
        ...state,
        accumulatedMs: elapsed(state, now),
        startedAt: null,
    };
}

export function lap(state: StopwatchState, now: number): StopwatchState {
    if (state.startedAt === null) {
        return state;
    }

    // Kept to the hundredths that are shown, so lap times always add up to
    // the totals on screen and laps that look equal compare as equal.
    const total = Math.floor(elapsed(state, now) / 10) * 10;

    return { ...state, laps: [...state.laps, total] };
}

export function reset(): StopwatchState {
    return initialStopwatch();
}

// Time since the last lap (or the start).
export function currentLapMs(state: StopwatchState, now: number) {
    const last = state.laps.length ? state.laps[state.laps.length - 1] : 0;

    return Math.max(0, elapsed(state, now) - last);
}

// Rows for display, newest first. The fastest and slowest laps are marked
// once there are at least two to compare.
export function lapRows(laps: number[]): LapRow[] {
    const rows = laps.map((totalMs, index) => ({
        className: 'lap',
        lapMs: totalMs - (index ? laps[index - 1] : 0),
        number: index + 1,
        totalMs,
    }));

    if (rows.length >= 2) {
        let fastest = rows[0];
        let slowest = rows[0];

        for (const row of rows) {
            if (row.lapMs < fastest.lapMs) {
                fastest = row;
            }

            if (row.lapMs > slowest.lapMs) {
                slowest = row;
            }
        }

        // All laps the same: nothing stands out.
        if (fastest.lapMs !== slowest.lapMs) {
            fastest.className = 'lap fastest';
            slowest.className = 'lap slowest';
        }
    }

    return rows.reverse();
}

function pad(value: number) {
    return value < 10 ? `0${value}` : `${value}`;
}

// "MM:SS.hh", or "H:MM:SS.hh" after an hour. Hundredths are truncated, not
// rounded, so the display never shows a time that hasn't happened yet.
export function formatStopwatch(ms: number) {
    const totalHundredths = Math.floor(Math.max(0, ms) / 10);
    const hundredths = totalHundredths % 100;
    const totalSeconds = Math.floor(totalHundredths / 100);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    const tail = `${pad(seconds)}.${pad(hundredths)}`;

    if (hours) {
        return `${hours}:${pad(minutes)}:${tail}`;
    }

    return `${pad(minutes)}:${tail}`;
}

// Checks saved state before trusting it.
export function isStopwatchState(value: any): value is StopwatchState {
    return (
        !!value &&
        typeof value === 'object' &&
        typeof value.accumulatedMs === 'number' &&
        isFinite(value.accumulatedMs) &&
        value.accumulatedMs >= 0 &&
        (value.startedAt === null ||
            (typeof value.startedAt === 'number' &&
                isFinite(value.startedAt))) &&
        Array.isArray(value.laps) &&
        value.laps.every(
            (lap: unknown) => typeof lap === 'number' && isFinite(lap)
        )
    );
}
