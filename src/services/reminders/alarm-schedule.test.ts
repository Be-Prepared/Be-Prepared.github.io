import {
    afterRinging,
    AlarmEntry,
    dueAlarms,
    formatClock,
    isAlarmEntry,
    nextOccurrence,
    nextOfAll,
    shouldRingAloud,
    timeUntil,
} from './alarm-schedule';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Local times, so tests pass in any time zone.
const at = (y: number, mo: number, d: number, h: number, mi: number) =>
    new Date(y, mo - 1, d, h, mi).getTime();

const alarm = (fields: Partial<AlarmEntry> = {}): AlarmEntry => ({
    days: [],
    enabled: true,
    hour: 7,
    id: 'a',
    label: '',
    minute: 0,
    notBefore: 0,
    ...fields,
});

// 2026-10-05 is a Monday.
const MONDAY_6AM = at(2026, 10, 5, 6, 0);

test('one-time alarm later today', () => {
    assert.equal(nextOccurrence(alarm(), MONDAY_6AM), at(2026, 10, 5, 7, 0));
});

test('one-time alarm already passed today goes to tomorrow', () => {
    assert.equal(
        nextOccurrence(alarm(), at(2026, 10, 5, 7, 30)),
        at(2026, 10, 6, 7, 0)
    );
});

test('exactly at the ring time looks for the next one', () => {
    assert.equal(
        nextOccurrence(alarm(), at(2026, 10, 5, 7, 0)),
        at(2026, 10, 6, 7, 0)
    );
});

test('notBefore stops a new alarm from counting an earlier time', () => {
    // Created at 07:30, checked from 06:00 (the last check).
    const entry = alarm({ notBefore: at(2026, 10, 5, 7, 30) });
    assert.equal(nextOccurrence(entry, MONDAY_6AM), at(2026, 10, 6, 7, 0));
});

test('created a moment before still rings today', () => {
    const entry = alarm({ notBefore: at(2026, 10, 5, 6, 59) });
    assert.equal(nextOccurrence(entry, MONDAY_6AM), at(2026, 10, 5, 7, 0));
});

test('weekday alarm skips the weekend', () => {
    const weekdays = alarm({ days: [1, 2, 3, 4, 5] });
    // Friday after the alarm -> Monday.
    assert.equal(
        nextOccurrence(weekdays, at(2026, 10, 9, 8, 0)),
        at(2026, 10, 12, 7, 0)
    );
});

test('weekly alarm finds the day a week out', () => {
    const mondays = alarm({ days: [1] });
    assert.equal(
        nextOccurrence(mondays, at(2026, 10, 5, 8, 0)),
        at(2026, 10, 12, 7, 0)
    );
});

test('disabled alarms never ring', () => {
    assert.equal(nextOccurrence(alarm({ enabled: false }), MONDAY_6AM), null);
});

test('dueAlarms finds what rang between checks', () => {
    const entries = [
        alarm({ id: 'a' }),
        alarm({ id: 'b', hour: 9 }),
        alarm({ id: 'c', enabled: false }),
    ];
    const due = dueAlarms(entries, MONDAY_6AM, at(2026, 10, 5, 8, 0));
    assert.deepEqual(
        due.map((d) => d.entry.id),
        ['a']
    );
    assert.equal(due[0].dueAt, at(2026, 10, 5, 7, 0));
});

test('afterRinging switches off one-time alarms only', () => {
    assert.equal(afterRinging(alarm()).enabled, false);
    assert.ok(afterRinging(alarm({ days: [1] })).enabled);
});

test('nextOfAll', () => {
    const entries = [alarm({ hour: 9 }), alarm({ hour: 6, minute: 30 })];
    assert.equal(nextOfAll(entries, MONDAY_6AM), at(2026, 10, 5, 6, 30));
    assert.equal(nextOfAll([], MONDAY_6AM), null);
});

test('shouldRingAloud', () => {
    assert.ok(shouldRingAloud(1000, 1000));
    assert.ok(shouldRingAloud(0, 9 * 60000));
    assert.equal(shouldRingAloud(0, 11 * 60000), false);
});

test('timeUntil', () => {
    assert.deepEqual(timeUntil(MONDAY_6AM + 61 * 60000, MONDAY_6AM), {
        days: 0,
        hours: 1,
        minutes: 1,
    });
    assert.deepEqual(timeUntil(MONDAY_6AM + 30000, MONDAY_6AM), {
        days: 0,
        hours: 0,
        minutes: 1,
    });
    assert.equal(timeUntil(MONDAY_6AM + 2 * 86400000, MONDAY_6AM).days, 2);
});

test('formatClock', () => {
    assert.deepEqual(formatClock(7, 5, false), { suffix: '', time: '07:05' });
    assert.deepEqual(formatClock(0, 0, true), { suffix: 'AM', time: '12:00' });
    assert.deepEqual(formatClock(13, 30, true), { suffix: 'PM', time: '1:30' });
    assert.deepEqual(formatClock(12, 0, true), { suffix: 'PM', time: '12:00' });
});

test('isAlarmEntry', () => {
    assert.ok(isAlarmEntry(alarm()));
    assert.equal(isAlarmEntry({ ...alarm(), hour: 24 }), false);
    assert.equal(isAlarmEntry({ ...alarm(), days: [7] }), false);
    assert.equal(isAlarmEntry(null), false);
});
