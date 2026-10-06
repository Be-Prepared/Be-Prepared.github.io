// Pure scheduling math for alarm clock alarms. Uses the device's local time
// zone through Date, so daylight saving changes are handled by the browser.

export interface AlarmEntry {
    // 0 = Sunday ... 6 = Saturday. Empty means "once", at the next time the
    // clock reads hour:minute.
    days: number[];
    enabled: boolean;
    hour: number;
    id: string;
    label: string;
    minute: number;
    // For one-time alarms: the earliest moment it may fire, so an alarm set
    // for 07:00 at 06:59 fires in a minute, but one set at 07:30 waits for
    // tomorrow.
    notBefore: number;
}

// An alarm that went off this long ago or less still makes noise when the
// app is opened. Older ones are only shown as missed.
export const LATE_RING_LIMIT_MS = 10 * 60000;

const DAY_MS = 24 * 60 * 60000;

export function isAlarmEntry(value: any): value is AlarmEntry {
    const int = (n: any, min: number, max: number) =>
        Number.isInteger(n) && n >= min && n <= max;

    return (
        !!value &&
        typeof value.id === 'string' &&
        typeof value.label === 'string' &&
        typeof value.enabled === 'boolean' &&
        int(value.hour, 0, 23) &&
        int(value.minute, 0, 59) &&
        Array.isArray(value.days) &&
        value.days.every((d: any) => int(d, 0, 6)) &&
        typeof value.notBefore === 'number' &&
        isFinite(value.notBefore)
    );
}

export function isAlarmList(value: any): value is AlarmEntry[] {
    return Array.isArray(value) && value.every(isAlarmEntry);
}

// The first time strictly after `after` that this alarm rings, or null when
// it's disabled.
export function nextOccurrence(entry: AlarmEntry, after: number) {
    if (!entry.enabled) {
        return null;
    }

    const from = Math.max(after, entry.notBefore - 1);
    const start = new Date(from);

    // Today's ring time, then step forward a day at a time. Building each
    // candidate from calendar fields (not adding 24h) keeps the wall-clock
    // time right across daylight saving changes.
    for (let offset = 0; offset <= 7; offset += 1) {
        const candidate = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() + offset,
            entry.hour,
            entry.minute,
            0,
            0
        );
        const time = candidate.getTime();

        if (time <= from) {
            continue;
        }

        if (entry.days.length && !entry.days.includes(candidate.getDay())) {
            continue;
        }

        return time;
    }

    return null;
}

// Alarms that rang in (after, now], with when they were due.
export function dueAlarms(
    entries: AlarmEntry[],
    after: number,
    now: number
): { entry: AlarmEntry; dueAt: number }[] {
    const due = [];

    for (const entry of entries) {
        const next = nextOccurrence(entry, after);

        if (next !== null && next <= now) {
            due.push({ entry, dueAt: next });
        }
    }

    return due;
}

// What an alarm looks like after it has rung: one-time alarms switch off.
export function afterRinging(entry: AlarmEntry): AlarmEntry {
    return entry.days.length ? entry : { ...entry, enabled: false };
}

// The soonest ring time across all alarms, or null.
export function nextOfAll(entries: AlarmEntry[], after: number) {
    let best: number | null = null;

    for (const entry of entries) {
        const next = nextOccurrence(entry, after);

        if (next !== null && (best === null || next < best)) {
            best = next;
        }
    }

    return best;
}

export function shouldRingAloud(dueAt: number, now: number) {
    return now - dueAt <= LATE_RING_LIMIT_MS;
}

// "in 9 h 5 min", "in 12 min", "in less than a minute" as parts for i18n.
export function timeUntil(target: number, now: number) {
    const minutes = Math.max(0, Math.ceil((target - now) / 60000));

    return {
        days: Math.floor(minutes / (DAY_MS / 60000)),
        hours: Math.floor(minutes / 60) % 24,
        minutes: minutes % 60,
    };
}

function pad(value: number) {
    return value < 10 ? `0${value}` : `${value}`;
}

// "07:05" or, for 12-hour clocks, { time: "7:05", suffix: "AM" }.
export function formatClock(hour: number, minute: number, twelveHour: boolean) {
    if (!twelveHour) {
        return { suffix: '', time: `${pad(hour)}:${pad(minute)}` };
    }

    return {
        suffix: hour >= 12 ? 'PM' : 'AM',
        time: `${hour % 12 || 12}:${pad(minute)}`,
    };
}

export function newAlarmId(now: number, random = Math.random()) {
    return `${now.toString(36)}${Math.floor(random * 1e6).toString(36)}`;
}
