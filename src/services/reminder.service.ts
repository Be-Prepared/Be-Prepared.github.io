import {
    afterRinging,
    AlarmEntry,
    dueAlarms,
    isAlarmList,
    newAlarmId,
    nextOfAll,
    shouldRingAloud,
} from './reminders/alarm-schedule';
import { BehaviorSubject } from 'rxjs';
import {
    finish,
    initialTimer,
    isFinished,
    isTimerState,
    pause,
    remainingMs,
    reset,
    resume,
    setDuration,
    start,
    TimerState,
} from '../timer-app/timer-math';
import { LocalStorageService } from './local-storage.service';

export interface Ringing {
    // When it was supposed to go off.
    dueAt: number;
    // Alarm id, or null for the countdown timer.
    alarmId: string | null;
    kind: 'timer' | 'alarm';
    label: string;
    // False when it went off long ago (the app was closed); shown but silent.
    loud: boolean;
}

interface Snooze {
    alarmId: string;
    at: number;
    label: string;
}

const SNOOZE_MS = 9 * 60000;

// Check at least this often, as a safety net for sleeping timers.
const MAX_WAIT_MS = 30000;

const timerStorage = LocalStorageService.json<TimerState>(
    'timer.state',
    1,
    isTimerState
);
const alarmStorage = LocalStorageService.json<AlarmEntry[]>(
    'alarmClock.alarms',
    1,
    isAlarmList
);
const snoozeStorage = LocalStorageService.json<Snooze[]>(
    'alarmClock.snoozes',
    1,
    (value) =>
        Array.isArray(value) &&
        value.every(
            (s: any) =>
                s &&
                typeof s.alarmId === 'string' &&
                typeof s.at === 'number' &&
                typeof s.label === 'string'
        )
);
// The last moment alarms were checked. Anything due between then and now
// went off while the app was closed.
const lastCheckStorage = LocalStorageService.number('alarmClock.lastCheck');

// The countdown timer and alarm clock live here instead of in their screens,
// so they go off whichever tool is open. A web app can only do this while
// it's open: if the app is closed or the phone suspends it, nothing can play
// a sound. Anything missed is shown the next time the app opens.
export class ReminderService {
    readonly alarms = new BehaviorSubject<AlarmEntry[]>(
        alarmStorage.getItem() || []
    );
    readonly ringing = new BehaviorSubject<Ringing[]>([]);
    readonly timer = new BehaviorSubject<TimerState>(
        timerStorage.getItem() || initialTimer()
    );
    private _initialized = false;
    private _now: () => number;
    private _snoozes: Snooze[] = snoozeStorage.getItem() || [];
    private _wakeTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(now: () => number = () => Date.now()) {
        this._now = now;
    }

    // Starts watching the clock. Called once when the app starts.
    init() {
        if (this._initialized) {
            return;
        }

        this._initialized = true;

        if (typeof document !== 'undefined') {
            // Timers sleep while the page is hidden; catch up on return.
            document.addEventListener('visibilitychange', () => this.check());
        }

        this.check();
    }

    // Alarm clock

    addAlarm(fields: Omit<AlarmEntry, 'id' | 'notBefore' | 'enabled'>) {
        const now = this._now();
        const entry: AlarmEntry = {
            ...fields,
            enabled: true,
            id: newAlarmId(now),
            notBefore: now,
        };
        this._saveAlarms([...this.alarms.value, entry]);

        return entry;
    }

    nextAlarmTime() {
        const now = this._now();
        const times = [
            nextOfAll(this.alarms.value, now),
            ...this._snoozes.map((s) => s.at),
        ].filter((t): t is number => t !== null && t > now);

        return times.length ? Math.min(...times) : null;
    }

    removeAlarm(id: string) {
        this._saveAlarms(this.alarms.value.filter((a) => a.id !== id));
        this._saveSnoozes(this._snoozes.filter((s) => s.alarmId !== id));
    }

    updateAlarm(id: string, changes: Partial<AlarmEntry>) {
        const now = this._now();
        this._saveAlarms(
            this.alarms.value.map((alarm) => {
                if (alarm.id !== id) {
                    return alarm;
                }

                // Changing the time or switching it back on starts fresh, so
                // a one-time alarm doesn't count a time already passed.
                return { ...alarm, ...changes, id, notBefore: now };
            })
        );
    }

    // Countdown timer

    pauseTimer() {
        this._setTimer(pause(this.timer.value, this._now()));
    }

    resetTimer() {
        this._setTimer(reset(this.timer.value));
        this._clearRinging((r) => r.kind === 'timer');
    }

    restartTimer() {
        this._clearRinging((r) => r.kind === 'timer');
        this._setTimer(start(reset(this.timer.value), this._now()));
    }

    resumeTimer() {
        this._setTimer(resume(this.timer.value, this._now()));
    }

    setTimerDuration(ms: number) {
        this._setTimer(setDuration(this.timer.value, ms));
    }

    startTimer() {
        this._setTimer(start(this.timer.value, this._now()));
    }

    timerRemaining() {
        return remainingMs(this.timer.value, this._now());
    }

    // Ringing

    // Stops everything that's ringing. A finished timer goes back to its
    // starting duration.
    dismissAll() {
        if (this.timer.value.status === 'done') {
            this._setTimer(reset(this.timer.value));
        }

        this.ringing.next([]);
    }

    // Rings again later. Only alarms can be snoozed.
    snoozeAll(ms = SNOOZE_MS) {
        const at = this._now() + ms;
        const alarms = this.ringing.value.filter((r) => r.kind === 'alarm');
        this._saveSnoozes([
            ...this._snoozes,
            ...alarms.map((r) => ({
                alarmId: r.alarmId as string,
                at,
                label: r.label,
            })),
        ]);
        this._clearRinging((r) => r.kind === 'alarm');
        this._schedule();
    }

    // Looks for anything due. Safe to call any time.
    check() {
        const now = this._now();
        const found: Ringing[] = [];
        const timer = this.timer.value;

        if (isFinished(timer, now)) {
            found.push({
                alarmId: null,
                dueAt: timer.endAt as number,
                kind: 'timer',
                label: '',
                loud: shouldRingAloud(timer.endAt as number, now),
            });
            this._setTimer(finish(timer), false);
        }

        // First run ever: nothing could have been missed.
        const lastCheck = lastCheckStorage.getItem() ?? now;
        const due = dueAlarms(this.alarms.value, lastCheck, now);

        if (due.length) {
            const rung = new Set(due.map((d) => d.entry.id));
            this._saveAlarms(
                this.alarms.value.map((a) => (rung.has(a.id) ? afterRinging(a) : a))
            );

            for (const { entry, dueAt } of due) {
                found.push({
                    alarmId: entry.id,
                    dueAt,
                    kind: 'alarm',
                    label: entry.label,
                    loud: shouldRingAloud(dueAt, now),
                });
            }
        }

        const snoozesDue = this._snoozes.filter((s) => s.at <= now);

        if (snoozesDue.length) {
            this._saveSnoozes(this._snoozes.filter((s) => s.at > now));

            for (const snooze of snoozesDue) {
                found.push({
                    alarmId: snooze.alarmId,
                    dueAt: snooze.at,
                    kind: 'alarm',
                    label: snooze.label,
                    loud: shouldRingAloud(snooze.at, now),
                });
            }
        }

        lastCheckStorage.setItem(now);

        if (found.length) {
            this.ringing.next([...this.ringing.value, ...found]);
        }

        this._schedule();
    }

    private _clearRinging(predicate: (r: Ringing) => boolean) {
        const remaining = this.ringing.value.filter((r) => !predicate(r));

        if (remaining.length !== this.ringing.value.length) {
            this.ringing.next(remaining);
        }
    }

    private _saveAlarms(alarms: AlarmEntry[]) {
        alarmStorage.setItem(alarms);
        this.alarms.next(alarms);
        this._schedule();
    }

    private _saveSnoozes(snoozes: Snooze[]) {
        this._snoozes = snoozes;
        snoozeStorage.setItem(snoozes);
    }

    // Wakes up for the next thing due. Browsers delay timers in the
    // background, so this also re-checks regularly and on visibility changes.
    private _schedule() {
        if (!this._initialized) {
            return;
        }

        if (this._wakeTimer !== null) {
            clearTimeout(this._wakeTimer);
            this._wakeTimer = null;
        }

        const now = this._now();
        const candidates = [
            this.nextAlarmTime(),
            this.timer.value.status === 'running'
                ? this.timer.value.endAt
                : null,
        ].filter((t): t is number => t !== null);

        if (!candidates.length) {
            return;
        }

        const wait = Math.min(
            MAX_WAIT_MS,
            Math.max(0, Math.min(...candidates) - now + 20)
        );
        this._wakeTimer = setTimeout(() => {
            this._wakeTimer = null;
            this.check();
        }, wait);
    }

    private _setTimer(state: TimerState, schedule = true) {
        timerStorage.setItem(state);
        this.timer.next(state);

        if (schedule) {
            this._schedule();
        }
    }
}
