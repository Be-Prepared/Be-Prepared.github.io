import { AlarmEntry, formatClock, timeUntil } from '../services/reminders/alarm-schedule';
import { AlarmSoundService } from '../services/alarm-sound.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';
import { parseTimeInput, summarizeDays, toggleDay, weekOrder } from './days';
import { ReminderService } from '../services/reminder.service';
import { Subscription } from 'rxjs';
import { TimeService } from '../services/time.service';
import { WakeLockService } from '../services/wake-lock.service';

interface AlarmRow {
    daysText: string;
    id: string;
    label: string;
    pressed: string;
    rowClass: string;
    suffix: string;
    time: string;
}

interface DayChip {
    className: string;
    day: number;
    label: string;
    pressed: string;
}

// January 4, 2026 was a Sunday; used to get localized day names.
const A_SUNDAY = new Date(2026, 0, 4);

function firstDayOfWeek(language: string) {
    try {
        const locale = new Intl.Locale(language) as any;
        const info = locale.getWeekInfo?.() || locale.weekInfo;

        if (info && info.firstDay) {
            // 1 = Monday ... 7 = Sunday.
            return info.firstDay % 7;
        }
    } catch (_ignore) {}

    return /-(US|CA|JP|BR|MX|IL|PH|KR|TW|ZA)$/i.test(language) ? 0 : 1;
}

function dayName(day: number, language: string, style: 'short' | 'narrow') {
    const date = new Date(A_SUNDAY);
    date.setDate(date.getDate() + day);

    try {
        return new Intl.DateTimeFormat(language, { weekday: style }).format(
            date
        );
    } catch (_ignore) {
        return `${day}`;
    }
}

export class AlarmClockAppComponent {
    private _alarmSound = di(AlarmSoundService);
    private _alarms: AlarmEntry[] = [];
    private _clockTimer: ReturnType<typeof setTimeout> | null = null;
    private _editDays: number[] = [];
    private _i18nService = di(I18nService);
    private _language = di(I18nService).locale();
    private _order = weekOrder(firstDayOfWeek(this._language));
    private _reminderService = di(ReminderService);
    private _subscription: Subscription | null = null;
    private _timeService = di(TimeService);
    private _wakeLockService = di(WakeLockService);
    cancelClass = 'wide';
    clockSuffix = '';
    clockTime = '';
    dateText = '';
    dayChips: DayChip[] = [];
    editId: string | null = null;
    editing = false;
    labelInput?: HTMLInputElement;
    nextText = '';
    nightstand = false;
    rows: AlarmRow[] = [];
    timeInput?: HTMLInputElement;

    onInit() {
        this._subscription = this._reminderService.alarms.subscribe(
            (alarms) => {
                this._alarms = alarms;
                this._renderRows();
                this._renderClock();
            }
        );
        this._tick();
    }

    onDestroy() {
        this._subscription?.unsubscribe();

        if (this._clockTimer !== null) {
            clearTimeout(this._clockTimer);
        }

        this._wakeLockService.release();
    }

    add() {
        this._openEditor(null);
    }

    cancelEdit() {
        this.editing = false;
    }

    deleteAlarm() {
        if (this.editId) {
            this._reminderService.removeAlarm(this.editId);
        }

        this.editing = false;
    }

    edit(id: string) {
        this._openEditor(id);
    }

    enterNightstand() {
        // A tap here also gets the alarm sound ready.
        this._alarmSound.unlock();
        this.nightstand = true;
        this._wakeLockService.request();
    }

    exitNightstand() {
        this.nightstand = false;
        this._wakeLockService.release();
    }

    save() {
        const time = parseTimeInput(this.timeInput?.value || '');

        if (!time) {
            this.timeInput?.focus();

            return;
        }

        const fields = {
            days: this._editDays,
            hour: time.hour,
            label: (this.labelInput?.value || '').trim().slice(0, 60),
            minute: time.minute,
        };
        this._alarmSound.unlock();

        if (this.editId) {
            this._reminderService.updateAlarm(this.editId, {
                ...fields,
                enabled: true,
            });
        } else {
            this._reminderService.addAlarm(fields);
        }

        this.editing = false;
    }

    toggle(id: string) {
        const alarm = this._alarms.find((a) => a.id === id);

        if (alarm) {
            this._alarmSound.unlock();
            this._reminderService.updateAlarm(id, { enabled: !alarm.enabled });
        }
    }

    toggleDay(day: number) {
        this._editDays = toggleDay(this._editDays, day);
        this._renderChips();
    }

    private _daysText(days: number[]) {
        const summary = summarizeDays(days);

        if (summary) {
            return this._i18nService.get(`alarmClock.days.${summary}`);
        }

        return this._order
            .filter((day) => days.includes(day))
            .map((day) => dayName(day, this._language, 'short'))
            .join(', ');
    }

    private _openEditor(id: string | null) {
        const alarm = id ? this._alarms.find((a) => a.id === id) : null;
        const now = new Date();
        const hour = alarm ? alarm.hour : (now.getHours() + 1) % 24;
        const minute = alarm ? alarm.minute : 0;
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        this.editId = alarm ? alarm.id : null;
        // Cancel fills the row when there's no Delete button beside it.
        this.cancelClass = alarm ? '' : 'wide';
        this._editDays = alarm ? [...alarm.days] : [];
        this._renderChips();
        this.editing = true;

        // Inputs appear a tick after the editor opens.
        setTimeout(() => {
            if (this.timeInput) {
                this.timeInput.value = `${pad(hour)}:${pad(minute)}`;
            }

            if (this.labelInput) {
                this.labelInput.value = alarm ? alarm.label : '';
            }
        });
    }

    private _renderChips() {
        this.dayChips = this._order.map((day) => {
            const on = this._editDays.includes(day);

            return {
                className: on ? 'chip on' : 'chip',
                day,
                label: dayName(day, this._language, 'narrow'),
                pressed: `${on}`,
            };
        });
    }

    private _renderClock() {
        const now = new Date();
        const clock = formatClock(
            now.getHours(),
            now.getMinutes(),
            this._timeService.isTwelveHour()
        );
        this.clockTime = clock.time;
        this.clockSuffix = clock.suffix
            ? this._i18nService.get(`info.time12Hour.${clock.suffix}`)
            : '';

        try {
            this.dateText = new Intl.DateTimeFormat(this._language, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            }).format(now);
        } catch (_ignore) {
            this.dateText = now.toDateString();
        }

        const next = this._reminderService.nextAlarmTime();

        if (next === null) {
            this.nextText = this._i18nService.get('alarmClock.noneEnabled');
        } else {
            const left = timeUntil(next, now.getTime());
            const get = (id: string) => this._i18nService.get(id);
            const parts = [];

            if (left.days) {
                parts.push(`${left.days} ${get('alarmClock.unitDay')}`);
            }

            if (left.days || left.hours) {
                parts.push(`${left.hours} ${get('alarmClock.unitHour')}`);
            }

            parts.push(`${left.minutes} ${get('alarmClock.unitMinute')}`);
            this.nextText = `${get('alarmClock.nextIn')} ${parts.join(' ')}`;
        }
    }

    private _renderRows() {
        const twelveHour = this._timeService.isTwelveHour();
        this.rows = [...this._alarms]
            .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
            .map((alarm) => {
                const clock = formatClock(alarm.hour, alarm.minute, twelveHour);

                return {
                    daysText: this._daysText(alarm.days),
                    id: alarm.id,
                    label: alarm.label,
                    pressed: `${alarm.enabled}`,
                    rowClass: alarm.enabled ? 'alarm on' : 'alarm',
                    suffix: clock.suffix
                        ? this._i18nService.get(`info.time12Hour.${clock.suffix}`)
                        : '',
                    time: clock.time,
                };
            });
    }

    // Updates right as each minute changes.
    private _tick() {
        this._renderClock();
        const now = Date.now();
        this._clockTimer = setTimeout(
            () => this._tick(),
            60000 - (now % 60000) + 50
        );
    }
}

component(
    'alarm-clock-app',
    {
        style: css`
            .page {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
                max-width: 32rem;
                margin: 0 auto;
            }

            .clock {
                text-align: center;
                padding: var(--space-3) 0;
            }

            .time {
                font-size: clamp(3.5rem, 18vw, 6rem);
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }

            .suffix {
                font-size: 1.5rem;
                font-weight: 600;
                margin-inline-start: 0.25em;
                color: var(--fg-muted);
            }

            .date,
            .next {
                color: var(--fg-muted);
                margin-top: var(--space-2);
            }

            .next {
                color: var(--accent);
                font-weight: 600;
            }

            .alarms {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }

            .empty {
                text-align: center;
                color: var(--fg-muted);
                padding: var(--space-4);
            }

            .alarm {
                display: flex;
                align-items: center;
                gap: var(--space-3);
                padding: var(--space-3) var(--space-4);
                border-radius: var(--radius-l);
                background: var(--surface);
                border: 1px solid var(--border);
            }

            .alarm-main {
                flex: 1 1 auto;
                min-width: 0;
                background: none;
                border: none;
                color: inherit;
                font: inherit;
                text-align: start;
                padding: 0;
                cursor: pointer;
                opacity: 0.55;
            }

            .alarm.on .alarm-main {
                opacity: 1;
            }

            .alarm-time {
                font-size: 2rem;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                line-height: 1.1;
            }

            .alarm-time small {
                font-size: 1rem;
                margin-inline-start: 0.25em;
                color: var(--fg-muted);
            }

            .alarm-detail {
                color: var(--fg-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .switch {
                flex-shrink: 0;
                width: 3.25rem;
                height: 2rem;
                border-radius: 999px;
                border: 1px solid var(--border);
                background: var(--surface-2);
                position: relative;
                cursor: pointer;
                padding: 0;
            }

            .switch::after {
                content: '';
                position: absolute;
                top: 3px;
                left: 3px;
                width: calc(2rem - 8px);
                height: calc(2rem - 8px);
                border-radius: 50%;
                background: var(--fg-muted);
                transition: transform 0.15s;
            }

            .alarm.on .switch {
                background: var(--accent);
                border-color: var(--accent);
            }

            .alarm.on .switch::after {
                background: var(--accent-fg);
                transform: translateX(1.25rem);
            }

            .editor {
                background: var(--surface);
                color: var(--fg);
                border: 1px solid var(--border);
                border-radius: var(--radius-l);
                padding: var(--space-4);
                width: min(26rem, 100%);
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
                max-height: 100%;
                overflow: auto;
            }

            .editor h2 {
                margin: 0;
                font-size: 1.25rem;
            }

            .field-label {
                font-size: 0.85rem;
                color: var(--fg-muted);
                font-weight: 600;
            }

            input[type='time'],
            input[type='text'] {
                font: inherit;
                width: 100%;
                box-sizing: border-box;
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-s);
                border: 1px solid var(--border);
                background: var(--bg);
                color: var(--fg);
            }

            input[type='time'] {
                font-size: 2rem;
                font-weight: 700;
                text-align: center;
            }

            .chips {
                display: flex;
                justify-content: space-between;
                gap: var(--space-1);
            }

            .chip {
                flex: 1 1 0;
                aspect-ratio: 1 / 1;
                max-width: 2.75rem;
                border-radius: 50%;
                border: 1px solid var(--border);
                background: var(--surface-2);
                color: var(--fg);
                font: inherit;
                font-weight: 700;
                cursor: pointer;
            }

            .chip.on {
                background: var(--accent);
                border-color: var(--accent);
                color: var(--accent-fg);
            }

            .editor-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--space-2);
            }

            .editor-actions .wide {
                grid-column: 1 / -1;
            }

            .nightstand {
                position: fixed;
                inset: 0;
                z-index: 20;
                background: #000;
                color: #6b4a2e;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: var(--space-3);
                cursor: pointer;
                user-select: none;
            }

            .nightstand .time {
                font-size: clamp(5rem, 28vmin, 14rem);
            }

            .nightstand .suffix,
            .nightstand .next,
            .nightstand .hint {
                color: #4a3420;
            }

            .nightstand-limits {
                max-width: 22rem;
                margin: 0 var(--space-4);
            }

            .nightstand .hint {
                position: absolute;
                bottom: var(--space-5);
                font-size: 0.85rem;
            }
        `,
        template: html`
            <default-layout>
                <div class="page">
                    <div class="clock">
                        <div>
                            <span class="time">{{clockTime}}</span
                            ><span class="suffix">{{clockSuffix}}</span>
                        </div>
                        <div class="date">{{dateText}}</div>
                        <div class="next">{{nextText}}</div>
                    </div>
                    <limits-notice
                        heading="reminderLimits.heading"
                        detail="reminderLimits.full.html"
                    ></limits-notice>
                    <div class="alarms">
                        <div *if="!rows.length" class="empty">
                            <i18n-label
                                id="alarmClock.noAlarms"
                                ws=""
                            ></i18n-label>
                        </div>
                        <div *for="row of rows" class="{{row.rowClass}}">
                            <button
                                class="alarm-main"
                                @click.stop.prevent="edit(row.id)"
                            >
                                <div class="alarm-time">
                                    {{row.time}}<small>{{row.suffix}}</small>
                                </div>
                                <div class="alarm-detail">
                                    {{row.daysText}}
                                    <span *if="row.label">· {{row.label}}</span>
                                </div>
                            </button>
                            <button
                                class="switch"
                                role="switch"
                                aria-checked="{{row.pressed}}"
                                @click.stop.prevent="toggle(row.id)"
                            ></button>
                        </div>
                    </div>
                </div>
                <icon-button
                    slot="more-buttons"
                    href="/moon.svg"
                    label-id="alarmClock.nightstand"
                    @click.stop.prevent="enterNightstand()"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    href="/add.svg"
                    label-id="alarmClock.add"
                    @click.stop.prevent="add()"
                ></icon-button>
            </default-layout>
            <show-modal *if="editing" @clickoutside="cancelEdit()">
                <div class="editor">
                    <h2>
                        <i18n-label id="alarmClock.editTitle" ws=""></i18n-label>
                    </h2>
                    <label class="field-label">
                        <i18n-label id="alarmClock.time" ws=""></i18n-label>
                    </label>
                    <input type="time" #ref="timeInput" required />
                    <div class="field-label">
                        <i18n-label id="alarmClock.repeat" ws=""></i18n-label>
                    </div>
                    <div class="chips">
                        <button
                            *for="chip of dayChips"
                            class="{{chip.className}}"
                            aria-pressed="{{chip.pressed}}"
                            @click.stop.prevent="toggleDay(chip.day)"
                        >
                            {{chip.label}}
                        </button>
                    </div>
                    <label class="field-label">
                        <i18n-label id="alarmClock.label" ws=""></i18n-label>
                    </label>
                    <input type="text" #ref="labelInput" maxlength="60" />
                    <limits-notice detail="reminderLimits.editor"></limits-notice>
                    <div class="editor-actions">
                        <pretty-button
                            class="wide"
                            variant="primary"
                            @click.stop.prevent="save()"
                            ><i18n-label id="alarmClock.save" ws=""></i18n-label
                        ></pretty-button>
                        <pretty-button
                            class="{{cancelClass}}"
                            @click.stop.prevent="cancelEdit()"
                            ><i18n-label
                                id="alarmClock.cancel"
                                ws=""
                            ></i18n-label
                        ></pretty-button>
                        <pretty-button
                            *if="editId"
                            @click.stop.prevent="deleteAlarm()"
                            ><i18n-label
                                id="alarmClock.delete"
                                ws=""
                            ></i18n-label
                        ></pretty-button>
                    </div>
                </div>
            </show-modal>
            <div
                *if="nightstand"
                class="nightstand"
                @click.stop.prevent="exitNightstand()"
            >
                <div>
                    <span class="time">{{clockTime}}</span
                    ><span class="suffix">{{clockSuffix}}</span>
                </div>
                <div class="next">{{nextText}}</div>
                <limits-notice
                    class="nightstand-limits"
                    detail="reminderLimits.nightstand"
                    dim
                ></limits-notice>
                <div class="hint">
                    <i18n-label
                        id="alarmClock.nightstandExit"
                        ws=""
                    ></i18n-label>
                </div>
            </div>
        `,
    },
    AlarmClockAppComponent
);
