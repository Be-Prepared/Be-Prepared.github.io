import { AlarmSoundService } from '../services/alarm-sound.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';
import {
    formatTimer,
    PRESET_MINUTES,
    progress,
    remainingMs,
    splitDuration,
    stepUnit,
    TimerState,
    TimeUnit,
} from './timer-math';
import { ReminderService } from '../services/reminder.service';
import { Subscription } from 'rxjs';
import { WakeLockService } from '../services/wake-lock.service';

interface Preset {
    className: string;
    label: string;
    ms: number;
}

// Circumference of the progress ring (r = 45 in a 100 x 100 view box).
const RING_LENGTH = 2 * Math.PI * 45;

// The countdown itself lives in ReminderService so it rings from any
// screen; this is only its controls and display.
export class TimerAppComponent {
    private _alarmSound = di(AlarmSoundService);
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    private _i18nService = di(I18nService);
    private _reminderService = di(ReminderService);
    private _state: TimerState = this._reminderService.timer.value;
    private _subscription: Subscription | null = null;
    private _wakeLockService = di(WakeLockService);
    canStart = false;
    display = '';
    hours = '00';
    labels: { [key: string]: string } = {};
    minutes = '00';
    presets: Preset[] = [];
    ring?: SVGCircleElement;
    ringLength = RING_LENGTH;
    seconds = '00';
    status = 'idle';

    onInit() {
        const get = (id: string) => this._i18nService.get(id);
        this.labels = {
            hDown: get('timer.hoursDown'),
            hUp: get('timer.hoursUp'),
            mDown: get('timer.minutesDown'),
            mUp: get('timer.minutesUp'),
            sDown: get('timer.secondsDown'),
            sUp: get('timer.secondsUp'),
        };
        this._subscription = this._reminderService.timer.subscribe((state) =>
            this._setState(state)
        );
    }

    onDestroy() {
        this._subscription?.unsubscribe();
        this._stopFrames();
        this._wakeLockService.release();
    }

    choosePreset(ms: number) {
        this._reminderService.setTimerDuration(ms);
    }

    dismiss() {
        this._reminderService.dismissAll();
    }

    pause() {
        this._reminderService.pauseTimer();
    }

    restart() {
        this._unlockSound();
        this._reminderService.restartTimer();
    }

    resume() {
        this._unlockSound();
        this._reminderService.resumeTimer();
    }

    start() {
        this._unlockSound();
        this._reminderService.startTimer();
    }

    step(unit: TimeUnit, delta: number) {
        this._reminderService.setTimerDuration(
            stepUnit(this._state.durationMs, unit, delta)
        );
    }

    stop() {
        this._reminderService.resetTimer();
    }

    private _render() {
        const now = Date.now();
        this.display = formatTimer(remainingMs(this._state, now));

        if (this.ring) {
            this.ring.style.strokeDashoffset = `${
                RING_LENGTH * (1 - progress(this._state, now))
            }`;
        }
    }

    private _setState(state: TimerState) {
        this._state = state;
        const parts = splitDuration(state.durationMs);
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        this.hours = pad(parts.h);
        this.minutes = pad(parts.m);
        this.seconds = pad(parts.s);
        this.canStart = state.durationMs > 0;
        this.status = state.status;
        const minuteLabel = this._i18nService.get('timer.minutesShort');
        this.presets = PRESET_MINUTES.map((minutes) => ({
            className:
                state.durationMs === minutes * 60000
                    ? 'preset selected'
                    : 'preset',
            label: `${minutes} ${minuteLabel}`,
            ms: minutes * 60000,
        }));
        this._render();
        // The ring is created a moment after the countdown screen appears.
        setTimeout(() => this._render());

        if (state.status === 'running') {
            this._startFrames();
            // Keep the screen on so the phone doesn't sleep and miss it.
            this._wakeLockService.request();
        } else {
            this._stopFrames();
            this._wakeLockService.release();
        }
    }

    private _startFrames() {
        if (this._frame !== null) {
            return;
        }

        const tick = () => {
            this._frame = requestAnimationFrame(tick);
            this._render();
        };
        this._frame = requestAnimationFrame(tick);
    }

    private _stopFrames() {
        if (this._frame !== null) {
            cancelAnimationFrame(this._frame);
            this._frame = null;
        }
    }

    // Browsers only allow sound after a tap, so get ready now for the alarm
    // later.
    private _unlockSound() {
        this._alarmSound.unlock();
    }
}

component(
    'timer-app',
    {
        style: css`
            .limits {
                width: 100%;
            }

            .wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100%;
                width: 100%;
                box-sizing: border-box;
            }

            .setup,
            .countdown {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-5);
                width: 100%;
                max-width: 28rem;
                padding: var(--space-3) 0;
            }

            .picker {
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }

            .unit {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-1);
            }

            .colon {
                font-size: 3rem;
                font-weight: 700;
                padding-bottom: 1.4rem;
                color: var(--fg-muted);
            }

            .value {
                font-size: 3.5rem;
                font-weight: 700;
                line-height: 1.1;
                font-variant-numeric: tabular-nums;
            }

            .unit-label {
                font-size: 0.8rem;
                color: var(--fg-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .stepper {
                width: var(--tap);
                height: 2.5rem;
                border-radius: var(--radius-m);
                border: 1px solid var(--border);
                background: var(--surface);
                color: var(--fg);
                font-family: inherit;
                font-size: 1.5rem;
                font-weight: 600;
                line-height: 1;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }

            .stepper:active,
            .preset:active,
            .action:active {
                transform: scale(0.96);
            }

            .presets {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: var(--space-2);
                width: 100%;
            }

            .preset {
                min-height: var(--tap);
                border-radius: var(--radius-m);
                border: 1px solid var(--border);
                background: var(--surface);
                color: var(--fg);
                font-family: inherit;
                font-size: 1.05rem;
                font-weight: 600;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }

            .preset.selected {
                background: var(--accent-soft);
                border-color: var(--accent);
            }

            .actions {
                display: flex;
                gap: var(--space-3);
                width: 100%;
            }

            .action {
                flex: 1 1 0;
                min-height: 3.5rem;
                border-radius: var(--radius-m);
                border: 1px solid var(--border);
                background: var(--surface-2);
                color: var(--fg);
                font-family: inherit;
                font-size: 1.2rem;
                font-weight: 700;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }

            .action.primary {
                background: var(--accent);
                border-color: var(--accent);
                color: var(--accent-fg);
            }

            .action:disabled {
                opacity: 0.4;
                cursor: default;
            }

            .stepper:focus-visible,
            .preset:focus-visible,
            .action:focus-visible {
                outline: 3px solid var(--accent);
                outline-offset: 2px;
            }

            .dial {
                position: relative;
                width: min(75vmin, 20rem);
                aspect-ratio: 1 / 1;
            }

            .dial svg {
                width: 100%;
                height: 100%;
                transform: rotate(-90deg);
            }

            .track {
                stroke: var(--surface-2);
            }

            .progress {
                stroke: var(--accent);
            }

            .center {
                position: absolute;
                inset: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
            }

            .remaining {
                font-size: min(15vmin, 4.5rem);
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }

            .status {
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--fg-muted);
                min-height: 1.5rem;
            }

            .done .status {
                color: var(--accent);
                font-size: 1.4rem;
            }

            @media (orientation: landscape) and (max-height: 500px) {
                .setup {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    align-items: center;
                    max-width: 48rem;
                    gap: var(--space-4) var(--space-5);
                }

                .setup .actions {
                    grid-column: 1 / -1;
                }

                .countdown {
                    flex-direction: row;
                    max-width: 44rem;
                }

                .countdown .actions {
                    flex-direction: column;
                }

                .dial {
                    width: min(70vh, 20rem);
                    flex-shrink: 0;
                }

                .remaining {
                    font-size: min(13vh, 4.5rem);
                }
            }
        `,
        template: html`
            <default-layout>
                <div class="wrapper">
                    <div *if="status === 'idle'" class="setup">
                        <div class="picker">
                            <div class="unit">
                                <button
                                    class="stepper"
                                    aria-label="{{labels.hUp}}"
                                    @click.stop.prevent="step('h', 1)"
                                >
                                    +
                                </button>
                                <div class="value">{{hours}}</div>
                                <button
                                    class="stepper"
                                    aria-label="{{labels.hDown}}"
                                    @click.stop.prevent="step('h', -1)"
                                >
                                    −
                                </button>
                                <div class="unit-label">
                                    <i18n-label
                                        id="timer.hours"
                                        ws=""
                                    ></i18n-label>
                                </div>
                            </div>
                            <div class="colon">:</div>
                            <div class="unit">
                                <button
                                    class="stepper"
                                    aria-label="{{labels.mUp}}"
                                    @click.stop.prevent="step('m', 1)"
                                >
                                    +
                                </button>
                                <div class="value">{{minutes}}</div>
                                <button
                                    class="stepper"
                                    aria-label="{{labels.mDown}}"
                                    @click.stop.prevent="step('m', -1)"
                                >
                                    −
                                </button>
                                <div class="unit-label">
                                    <i18n-label
                                        id="timer.minutes"
                                        ws=""
                                    ></i18n-label>
                                </div>
                            </div>
                            <div class="colon">:</div>
                            <div class="unit">
                                <button
                                    class="stepper"
                                    aria-label="{{labels.sUp}}"
                                    @click.stop.prevent="step('s', 1)"
                                >
                                    +
                                </button>
                                <div class="value">{{seconds}}</div>
                                <button
                                    class="stepper"
                                    aria-label="{{labels.sDown}}"
                                    @click.stop.prevent="step('s', -1)"
                                >
                                    −
                                </button>
                                <div class="unit-label">
                                    <i18n-label
                                        id="timer.seconds"
                                        ws=""
                                    ></i18n-label>
                                </div>
                            </div>
                        </div>
                        <div class="presets">
                            <button
                                *for="preset of presets"
                                class="{{preset.className}}"
                                @click.stop.prevent="choosePreset(preset.ms)"
                            >
                                {{preset.label}}
                            </button>
                        </div>
                        <limits-notice
                            class="limits"
                            detail="reminderLimits.timer"
                        ></limits-notice>
                        <div class="actions">
                            <button
                                class="action primary"
                                .disabled="!canStart"
                                @click.stop.prevent="start()"
                            >
                                <i18n-label id="timer.start" ws=""></i18n-label>
                            </button>
                        </div>
                    </div>
                    <div *if="status !== 'idle'" class="countdown {{status}}">
                        <div class="dial">
                            <svg viewBox="0 0 100 100" aria-hidden="true">
                                <circle
                                    class="track"
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke-width="6"
                                ></circle>
                                <circle
                                    class="progress"
                                    #ref="ring"
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke-width="6"
                                    stroke-linecap="round"
                                    stroke-dasharray="{{ringLength}}"
                                ></circle>
                            </svg>
                            <div class="center">
                                <div class="remaining" role="timer">
                                    {{display}}
                                </div>
                                <div class="status">
                                    <i18n-label
                                        *if="status === 'paused'"
                                        id="timer.paused"
                                        ws=""
                                    ></i18n-label>
                                    <i18n-label
                                        *if="status === 'done'"
                                        id="timer.done"
                                        ws=""
                                    ></i18n-label>
                                </div>
                            </div>
                        </div>
                        <div class="actions">
                            <button
                                *if="status === 'running'"
                                class="action primary"
                                @click.stop.prevent="pause()"
                            >
                                <i18n-label id="timer.pause" ws=""></i18n-label>
                            </button>
                            <button
                                *if="status === 'paused'"
                                class="action primary"
                                @click.stop.prevent="resume()"
                            >
                                <i18n-label
                                    id="timer.resume"
                                    ws=""
                                ></i18n-label>
                            </button>
                            <button
                                *if="status !== 'done'"
                                class="action"
                                @click.stop.prevent="stop()"
                            >
                                <i18n-label id="timer.reset" ws=""></i18n-label>
                            </button>
                            <button
                                *if="status === 'done'"
                                class="action primary"
                                @click.stop.prevent="dismiss()"
                            >
                                <i18n-label
                                    id="timer.dismiss"
                                    ws=""
                                ></i18n-label>
                            </button>
                            <button
                                *if="status === 'done'"
                                class="action"
                                @click.stop.prevent="restart()"
                            >
                                <i18n-label
                                    id="timer.restart"
                                    ws=""
                                ></i18n-label>
                            </button>
                        </div>
                        <limits-notice
                            *if="status !== 'done'"
                            class="limits"
                            detail="reminderLimits.timer"
                        ></limits-notice>
                    </div>
                </div>
            </default-layout>
        `,
    },
    TimerAppComponent
);
