import { parseTimeInput, summarizeDays, toggleDay, weekOrder } from './days';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('summarizeDays', () => {
    assert.equal(summarizeDays([]), 'once');
    assert.equal(summarizeDays([0, 1, 2, 3, 4, 5, 6]), 'everyDay');
    assert.equal(summarizeDays([5, 4, 3, 2, 1]), 'weekdays');
    assert.equal(summarizeDays([6, 0]), 'weekends');
    assert.equal(summarizeDays([1, 3]), null);
});

test('toggleDay keeps days sorted', () => {
    assert.deepEqual(toggleDay([3, 1], 2), [1, 2, 3]);
    assert.deepEqual(toggleDay([1, 2, 3], 2), [1, 3]);
});

test('weekOrder', () => {
    assert.deepEqual(weekOrder(0), [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(weekOrder(1), [1, 2, 3, 4, 5, 6, 0]);
});

test('parseTimeInput', () => {
    assert.deepEqual(parseTimeInput('07:30'), { hour: 7, minute: 30 });
    assert.deepEqual(parseTimeInput('23:59:00'), { hour: 23, minute: 59 });
    assert.equal(parseTimeInput(''), null);
    assert.equal(parseTimeInput('25:00'), null);
});
