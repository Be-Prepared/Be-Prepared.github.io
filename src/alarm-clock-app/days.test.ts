import { parseTimeInput, summarizeDays, toggleDay, weekOrder } from './days';
import test from 'ava';

test('summarizeDays', (t) => {
    t.is(summarizeDays([]), 'once');
    t.is(summarizeDays([0, 1, 2, 3, 4, 5, 6]), 'everyDay');
    t.is(summarizeDays([5, 4, 3, 2, 1]), 'weekdays');
    t.is(summarizeDays([6, 0]), 'weekends');
    t.is(summarizeDays([1, 3]), null);
});

test('toggleDay keeps days sorted', (t) => {
    t.deepEqual(toggleDay([3, 1], 2), [1, 2, 3]);
    t.deepEqual(toggleDay([1, 2, 3], 2), [1, 3]);
});

test('weekOrder', (t) => {
    t.deepEqual(weekOrder(0), [0, 1, 2, 3, 4, 5, 6]);
    t.deepEqual(weekOrder(1), [1, 2, 3, 4, 5, 6, 0]);
});

test('parseTimeInput', (t) => {
    t.deepEqual(parseTimeInput('07:30'), { hour: 7, minute: 30 });
    t.deepEqual(parseTimeInput('23:59:00'), { hour: 23, minute: 59 });
    t.is(parseTimeInput(''), null);
    t.is(parseTimeInput('25:00'), null);
});
