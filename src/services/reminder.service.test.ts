import { ReminderService } from './reminder.service';
import { storage } from './local-storage.service';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

// The service saves to storage; give each test a clean slate.
beforeEach(() => storage.clear());
afterEach(() => storage.clear());

function setup(start = new Date(2026, 9, 5, 6, 0).getTime()) {
    const clock = { now: start };
    const service = new ReminderService(() => clock.now);

    return { clock, service };
}

test('timer rings when it reaches zero', () => {
    const { clock, service } = setup();
    service.setTimerDuration(60000);
    service.startTimer();
    clock.now += 30000;
    service.check();
    assert.equal(service.ringing.value.length, 0);
    clock.now += 31000;
    service.check();
    assert.equal(service.ringing.value.length, 1);
    assert.equal(service.ringing.value[0].kind, 'timer');
    assert.ok(service.ringing.value[0].loud);
    assert.equal(service.timer.value.status, 'done');
    service.dismissAll();
    assert.equal(service.ringing.value.length, 0);
    assert.equal(service.timer.value.status, 'idle');
    assert.equal(service.timer.value.durationMs, 60000);
});

test('timer keeps going after the screen is gone', () => {
    // A second service instance reads what the first saved, like reopening
    // the app.
    const first = setup();
    first.service.setTimerDuration(60000);
    first.service.startTimer();
    const second = new ReminderService(() => first.clock.now + 120000);
    second.check();
    assert.equal(second.ringing.value.length, 1);
});

test('alarm rings once at its time', () => {
    const { clock, service } = setup();
    service.check();
    service.addAlarm({ days: [], hour: 7, label: 'Wake', minute: 0 });
    clock.now += 59 * 60000;
    service.check();
    assert.equal(service.ringing.value.length, 0);
    clock.now += 2 * 60000;
    service.check();
    assert.equal(service.ringing.value.length, 1);
    assert.equal(service.ringing.value[0].label, 'Wake');
    // One-time alarm switched itself off.
    assert.equal(service.alarms.value[0].enabled, false);
    service.dismissAll();
    clock.now += 24 * 3600000;
    service.check();
    assert.equal(service.ringing.value.length, 0);
});

test('repeating alarm stays on', () => {
    const { clock, service } = setup();
    service.check();
    service.addAlarm({ days: [0, 1, 2, 3, 4, 5, 6], hour: 7, label: '', minute: 0 });
    clock.now += 61 * 60000;
    service.check();
    assert.equal(service.ringing.value.length, 1);
    assert.ok(service.alarms.value[0].enabled);
});

test('missed alarm while closed is shown but silent', () => {
    const { clock, service } = setup();
    service.check();
    service.addAlarm({ days: [], hour: 7, label: '', minute: 0 });
    // The app was closed until 09:00.
    clock.now += 3 * 3600000;
    service.check();
    assert.equal(service.ringing.value.length, 1);
    assert.equal(service.ringing.value[0].loud, false);
});

test('snooze rings again later', () => {
    const { clock, service } = setup();
    service.check();
    service.addAlarm({ days: [], hour: 7, label: 'Up', minute: 0 });
    clock.now += 61 * 60000;
    service.check();
    service.snoozeAll(5 * 60000);
    assert.equal(service.ringing.value.length, 0);
    assert.equal(service.nextAlarmTime(), clock.now + 5 * 60000);
    clock.now += 5 * 60000;
    service.check();
    assert.equal(service.ringing.value.length, 1);
    assert.equal(service.ringing.value[0].label, 'Up');
});

test('removing an alarm drops its snooze', () => {
    const { clock, service } = setup();
    service.check();
    const entry = service.addAlarm({ days: [], hour: 7, label: '', minute: 0 });
    clock.now += 61 * 60000;
    service.check();
    service.snoozeAll();
    service.removeAlarm(entry.id);
    assert.equal(service.nextAlarmTime(), null);
});

test('first run does not invent missed alarms', () => {
    // An alarm saved before any check happened (no last check time).
    const { service } = setup();
    service.addAlarm({ days: [0, 1, 2, 3, 4, 5, 6], hour: 5, label: '', minute: 0 });
    service.check();
    assert.equal(service.ringing.value.length, 0);
});
