// Describes which days an alarm repeats on. Days are 0 (Sunday) to 6.

export type DaysSummary = 'once' | 'everyDay' | 'weekdays' | 'weekends';

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];

function same(a: number[], b: number[]) {
    return a.length === b.length && a.every((day) => b.includes(day));
}

// A named summary, or null when the days need to be listed.
export function summarizeDays(days: number[]): DaysSummary | null {
    if (!days.length) {
        return 'once';
    }

    if (days.length === 7) {
        return 'everyDay';
    }

    if (same(days, WEEKDAYS)) {
        return 'weekdays';
    }

    if (same(days, WEEKENDS)) {
        return 'weekends';
    }

    return null;
}

export function toggleDay(days: number[], day: number) {
    const next = days.includes(day)
        ? days.filter((d) => d !== day)
        : [...days, day];

    return next.sort((a, b) => a - b);
}

// Days in the order people expect for their locale's week. Most of the
// world starts on Monday; a few places start on Sunday.
export function weekOrder(firstDay: number) {
    return [0, 1, 2, 3, 4, 5, 6].map((i) => (i + firstDay) % 7);
}

// "07:30" from an <input type="time"> into hours and minutes.
export function parseTimeInput(value: string) {
    const match = /^(\d{1,2}):(\d{2})/.exec(value || '');

    if (!match) {
        return null;
    }

    const hour = +match[1];
    const minute = +match[2];

    if (hour > 23 || minute > 59) {
        return null;
    }

    return { hour, minute };
}
