import { AlarmSoundService } from '../services/alarm-sound.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { formatClock } from '../services/reminders/alarm-schedule';
import { I18nService } from '../i18n/i18n.service';
import { ReminderService, Ringing } from '../services/reminder.service';
import { Subscription } from 'rxjs';
import { TimeService } from '../services/time.service';
import { WakeLockService } from '../services/wake-lock.service';

// Stop the noise after a while in case the phone was left behind. The
// screen keeps pulsing until dismissed.
const MAX_RING_MS = 5 * 60000;

interface RingLine {
    label: string;
    time: string;
}

// Full-screen alert for the timer and alarm clock. It's added to the page
// once at startup and sits above whatever tool is open.
export class ReminderRingerComponent {
    private _alarmSound = di(AlarmSoundService);
    private _i18nService = di(I18nService);
    private _reminderService = di(ReminderService);
    private _ringStopTimer: ReturnType<typeof setTimeout> | null = null;
    private _subscription: Subscription | null = null;
    private _timeService = di(TimeService);
    private _unlock = () => this._alarmSound.unlock();
    private _vibrateTimer: ReturnType<typeof setInterval> | null = null;
    private _wakeLockService = di(WakeLockService);
    canRestartTimer = false;
    canSnooze = false;
    headingId = '';
    missedOnly = false;
    lines: RingLine[] = [];
    visible = false;

    onInit() {
        // Browsers only allow sound after a tap. Any tap anywhere in the app
        // gets the audio ready, so an alarm can sound later.
        document.addEventListener('pointerdown', this._unlock, true);
        this._subscription = this._reminderService.ringing.subscribe(
            (ringing) => this._update(ringing)
        );
    }

    onDestroy() {
        document.removeEventListener('pointerdown', this._unlock, true);
        this._subscription?.unsubscribe();
        this._stopNoise();
    }

    dismiss() {
        this._reminderService.dismissAll();
    }

    restartTimer() {
        this._reminderService.restartTimer();
    }

    snooze() {
        this._reminderService.snoozeAll();
    }

    private _format(ringing: Ringing): RingLine {
        const due = new Date(ringing.dueAt);
        const clock = formatClock(
            due.getHours(),
            due.getMinutes(),
            this._timeService.isTwelveHour()
        );
        const suffix = clock.suffix
            ? ` ${this._i18nService.get(`info.time12Hour.${clock.suffix}`)}`
            : '';
        const label =
            ringing.label ||
            this._i18nService.get(
                ringing.kind === 'timer' ? 'ringer.timer' : 'ringer.alarm'
            );
        const missed = ringing.loud
            ? ''
            : ` · ${this._i18nService.get('ringer.missed')}`;

        return { label, time: `${clock.time}${suffix}${missed}` };
    }

    private _startNoise(ringing: Ringing[]) {
        this._stopNoise();
        this._alarmSound.start('beep');
        const vibrate = () => {
            if (navigator.vibrate) {
                navigator.vibrate([400, 200, 400]);
            }
        };
        vibrate();
        this._vibrateTimer = setInterval(vibrate, 2000);
        // Count from when it was due, so opening the app after a missed
        // alarm doesn't ring for the full time.
        const oldest = Math.min(...ringing.map((r) => r.dueAt));
        const left = Math.max(10000, MAX_RING_MS - (Date.now() - oldest));
        this._ringStopTimer = setTimeout(() => this._stopNoise(), left);
    }

    private _stopNoise() {
        this._alarmSound.stop();

        if (this._vibrateTimer !== null) {
            clearInterval(this._vibrateTimer);
            this._vibrateTimer = null;

            if (navigator.vibrate) {
                navigator.vibrate(0);
            }
        }

        if (this._ringStopTimer !== null) {
            clearTimeout(this._ringStopTimer);
            this._ringStopTimer = null;
        }
    }

    private _update(ringing: Ringing[]) {
        const wasVisible = this.visible;
        this.visible = ringing.length > 0;
        this.lines = ringing.map((r) => this._format(r));
        this.canSnooze = ringing.some((r) => r.kind === 'alarm');
        this.canRestartTimer = ringing.some((r) => r.kind === 'timer');
        const loud = ringing.filter((r) => r.loud);
        this.missedOnly = this.visible && !loud.length;
        this.headingId = loud.length
            ? ringing.every((r) => r.kind === 'timer')
                ? 'ringer.timerDone'
                : 'ringer.alarmHeading'
            : 'ringer.missedHeading';

        if (!this.visible) {
            this._stopNoise();
            this._wakeLockService.release();

            return;
        }

        if (!wasVisible || loud.length) {
            this._wakeLockService.request();
        }

        if (loud.length) {
            this._startNoise(loud);
        }
    }
}

component(
    'reminder-ringer',
    {
        style: css`
            .overlay {
                position: fixed;
                inset: 0;
                z-index: 50;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: var(--space-4);
                box-sizing: border-box;
                background: var(--bg);
                overflow: auto;
            }

            .pulse {
                position: absolute;
                inset: 0;
                pointer-events: none;
                /* Slow pulse, well under the rate that can trigger
                   seizures. */
                animation: pulse 1s ease-in-out infinite alternate;
            }

            @keyframes pulse {
                from {
                    background: transparent;
                }

                to {
                    background: var(--accent-glow);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .pulse {
                    animation: none;
                    background: var(--accent-soft);
                }
            }

            .card {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-4);
                width: 100%;
                max-width: 26rem;
                margin: auto;
                text-align: center;
            }

            .icon {
                width: 5rem;
                height: 5rem;
                color: var(--accent);
            }

            h1 {
                margin: 0;
                font-size: 2rem;
            }

            .limits {
                width: 100%;
            }

            .lines {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                width: 100%;
            }

            .line {
                display: flex;
                justify-content: space-between;
                gap: var(--space-3);
                padding: var(--space-3) var(--space-4);
                border-radius: var(--radius-m);
                background: var(--surface);
                border: 1px solid var(--border);
                font-size: 1.15rem;
            }

            .line .time {
                font-weight: 700;
                font-variant-numeric: tabular-nums;
            }

            .actions {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                width: 100%;
                font-size: 1.2rem;
            }
        `,
        template: html`
            <div *if="visible" class="overlay" role="alertdialog">
                <div class="pulse"></div>
                <div class="card">
                    <load-svg class="icon" href="/alarm-clock.svg"></load-svg>
                    <h1><i18n-label id="{{headingId}}" ws=""></i18n-label></h1>
                    <limits-notice
                        *if="missedOnly"
                        class="limits"
                        detail="ringer.missedExplain"
                    ></limits-notice>
                    <div class="lines">
                        <div *for="line of lines" class="line">
                            <span>{{line.label}}</span>
                            <span class="time">{{line.time}}</span>
                        </div>
                    </div>
                    <div class="actions">
                        <pretty-button
                            variant="primary"
                            @click.stop.prevent="dismiss()"
                            ><i18n-label id="ringer.dismiss" ws=""></i18n-label
                        ></pretty-button>
                        <pretty-button
                            *if="canSnooze"
                            @click.stop.prevent="snooze()"
                            ><i18n-label id="ringer.snooze" ws=""></i18n-label
                        ></pretty-button>
                        <pretty-button
                            *if="canRestartTimer"
                            @click.stop.prevent="restartTimer()"
                            ><i18n-label
                                id="ringer.restartTimer"
                                ws=""
                            ></i18n-label
                        ></pretty-button>
                    </div>
                </div>
            </div>
        `,
    },
    ReminderRingerComponent
);
