import { ReminderService } from './reminder.service';
import { storage } from './local-storage.service';
import test from 'ava';

// The service saves to storage; give each test a clean slate.
test.beforeEach(() => storage.clear());
test.serial.afterEach(() => storage.clear());

function setup(start = new Date(2026, 9, 5, 6, 0).getTime()) {
    const clock = { now: start };
    const service = new ReminderService(() => clock.now);

    return { clock, service };
}

test.serial('timer rings when it reaches zero', (t) => {
    const { clock, service } = setup();
    service.setTimerDuration(60000);
    service.startTimer();
    clock.now += 30000;
    service.check();
    t.deepEqual(service.ringing.value, []);
    clock.now += 31000;
    service.check();
    t.is(service.ringing.value.length, 1);
    t.is(service.ringing.value[0].kind, 'timer');
    t.true(service.ringing.value[0].loud);
    t.is(service.timer.value.status, 'done');
    service.dismissAll();
    t.deepEqual(service.ringing.value, []);
    t.is(service.timer.value.status, 'idle');
    t.is(service.timer.value.durationMs, 60000);
});

test.serial('timer keeps going after the screen is gone', (t) => {
    // A second service instance reads what the first saved, like reopening
    // the app.
    const first = setup();
    first.service.setTimerDuration(60000);
    first.service.startTimer();
    const second = new ReminderService(() => first.clock.now + 120000);
    second.check();
    t.is(second.ringing.value.length, 1);
});

test.serial('alarm rings once at its time', (t) => {
    const { clock, service } = setup();
    service.check();
    service.addAlarm({ days: [], hour: 7, label: 'Wake', minute: 0 });
    clock.now += 59 * 60000;
    service.check();
    t.deepEqual(service.ringing.value, []);
    clock.now += 2 * 60000;
    service.check();
    t.is(service.ringing.value.length, 1);
    t.is(service.ringing.value[0].label, 'Wake');
    // One-time alarm switched itself off.
    t.false(service.alarms.value[0].enabled);
    service.dismissAll();
    clock.now += 24 * 3600000;
    service.check();
    t.deepEqual(service.ringing.value, []);
});

test.serial('repeating alarm stays on', (t) => {
    const { clock, service } = setup();
    service.check();
    service.addAlarm({ days: [0, 1, 2, 3, 4, 5, 6], hour: 7, label: '', minute: 0 });
    clock.now += 61 * 60000;
    service.check();
    t.is(service.ringing.value.length, 1);
    t.true(service.alarms.value[0].enabled);
});

test.serial('missed alarm while closed is shown but silent', (t) => {
    const { clock, service } = setup();
    service.check();
    service.addAlarm({ days: [], hour: 7, label: '', minute: 0 });
    // The app was closed until 09:00.
    clock.now += 3 * 3600000;
    service.check();
    t.is(service.ringing.value.length, 1);
    t.false(service.ringing.value[0].loud);
});

test.serial('snooze rings again later', (t) => {
    const { clock, service } = setup();
    service.check();
    service.addAlarm({ days: [], hour: 7, label: 'Up', minute: 0 });
    clock.now += 61 * 60000;
    service.check();
    service.snoozeAll(5 * 60000);
    t.deepEqual(service.ringing.value, []);
    t.is(service.nextAlarmTime(), clock.now + 5 * 60000);
    clock.now += 5 * 60000;
    service.check();
    t.is(service.ringing.value.length, 1);
    t.is(service.ringing.value[0].label, 'Up');
});

test.serial('removing an alarm drops its snooze', (t) => {
    const { clock, service } = setup();
    service.check();
    const entry = service.addAlarm({ days: [], hour: 7, label: '', minute: 0 });
    clock.now += 61 * 60000;
    service.check();
    service.snoozeAll();
    service.removeAlarm(entry.id);
    t.is(service.nextAlarmTime(), null);
});

test.serial('first run does not invent missed alarms', (t) => {
    // An alarm saved before any check happened (no last check time).
    const { service } = setup();
    service.addAlarm({ days: [0, 1, 2, 3, 4, 5, 6], hour: 5, label: '', minute: 0 });
    service.check();
    t.deepEqual(service.ringing.value, []);
});
