// Countdown timer state and math. Everything is based on the wall clock
// (Date.now), so the remaining time stays right even when the browser
// throttles timers or the page is in the background.

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface TimerState {
    durationMs: number;
    // When the timer reaches zero. Only set while running.
    endAt: number | null;
    // Time left while paused.
    pausedRemainingMs: number;
    status: TimerStatus;
}

export type TimeUnit = 'h' | 'm' | 's';

export const MAX_HOURS = 99;
export const MAX_DURATION_MS = ((MAX_HOURS * 60 + 59) * 60 + 59) * 1000;
export const PRESET_MINUTES = [1, 3, 5, 10, 15, 30];

export function initialTimer(durationMs = 5 * 60000): TimerState {
    return {
        durationMs: clampDuration(durationMs),
        endAt: null,
        pausedRemainingMs: 0,
        status: 'idle',
    };
}

// Whole seconds between zero and the maximum.
export function clampDuration(ms: number) {
    if (!isFinite(ms) || ms < 0) {
        return 0;
    }

    return Math.min(MAX_DURATION_MS, Math.round(ms / 1000) * 1000);
}

export function remainingMs(state: TimerState, now: number) {
    switch (state.status) {
        case 'running':
            return Math.max(0, (state.endAt as number) - now);

        case 'paused':
            return state.pausedRemainingMs;

        case 'done':
            return 0;

        default:
            return state.durationMs;
    }
}

// 1 when full, 0 when finished.
export function progress(state: TimerState, now: number) {
    if (state.durationMs <= 0) {
        return 0;
    }

    return Math.min(1, Math.max(0, remainingMs(state, now) / state.durationMs));
}

export function isFinished(state: TimerState, now: number) {
    return state.status === 'running' && now >= (state.endAt as number);
}

export function setDuration(state: TimerState, ms: number): TimerState {
    if (state.status !== 'idle') {
        return state;
    }

    return { ...state, durationMs: clampDuration(ms) };
}

export function start(state: TimerState, now: number): TimerState {
    if (state.status !== 'idle' || state.durationMs <= 0) {
        return state;
    }

    return { ...state, endAt: now + state.durationMs, status: 'running' };
}

export function pause(state: TimerState, now: number): TimerState {
    if (state.status !== 'running') {
        return state;
    }

    return {
        ...state,
        endAt: null,
        pausedRemainingMs: remainingMs(state, now),
        status: 'paused',
    };
}

export function resume(state: TimerState, now: number): TimerState {
    if (state.status !== 'paused') {
        return state;
    }

    return {
        ...state,
        endAt: now + state.pausedRemainingMs,
        pausedRemainingMs: 0,
        status: 'running',
    };
}

export function finish(state: TimerState): TimerState {
    return { ...state, endAt: null, pausedRemainingMs: 0, status: 'done' };
}

// Back to the start, keeping the chosen duration.
export function reset(state: TimerState): TimerState {
    return initialTimer(state.durationMs);
}

export function splitDuration(ms: number) {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);

    return {
        h: Math.floor(totalSeconds / 3600),
        m: Math.floor(totalSeconds / 60) % 60,
        s: totalSeconds % 60,
    };
}

export function joinDuration(h: number, m: number, s: number) {
    return ((h * 60 + m) * 60 + s) * 1000;
}

// Steps one unit up or down, wrapping around like a clock (59 minutes goes
// to 0) without carrying into the next unit.
export function stepUnit(ms: number, unit: TimeUnit, delta: number) {
    const parts = splitDuration(ms);
    const limit = unit === 'h' ? MAX_HOURS + 1 : 60;
    parts[unit] = (((parts[unit] + delta) % limit) + limit) % limit;

    return joinDuration(parts.h, parts.m, parts.s);
}

function pad(value: number) {
    return value < 10 ? `0${value}` : `${value}`;
}

// "M:SS" or "H:MM:SS". Rounds up, so the display shows 0:01 until the very
// end and reaches 0:00 exactly when the alarm goes off.
export function formatTimer(ms: number) {
    const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
    const { h, m, s } = splitDuration(totalSeconds * 1000);

    if (h) {
        return `${h}:${pad(m)}:${pad(s)}`;
    }

    return `${m}:${pad(s)}`;
}

export function isTimerState(value: any): value is TimerState {
    return (
        !!value &&
        typeof value === 'object' &&
        typeof value.durationMs === 'number' &&
        value.durationMs >= 0 &&
        value.durationMs <= MAX_DURATION_MS &&
        typeof value.pausedRemainingMs === 'number' &&
        isFinite(value.pausedRemainingMs) &&
        ['idle', 'running', 'paused', 'done'].includes(value.status) &&
        (value.status === 'running'
            ? typeof value.endAt === 'number' && isFinite(value.endAt)
            : value.endAt === null)
    );
}
