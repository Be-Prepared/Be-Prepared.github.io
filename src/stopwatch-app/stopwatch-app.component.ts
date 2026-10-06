import { component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';
import {
    currentLapMs,
    elapsed,
    formatStopwatch,
    initialStopwatch,
    isRunning,
    lap,
    lapRows,
    reset,
    start,
    StopwatchState,
    stop,
} from './stopwatch-math';
import { stopwatchStorage } from './stopwatch-storage';
import { WakeLockService } from '../services/wake-lock.service';

interface LapDisplay {
    className: string;
    lap: string;
    label: string;
    number: string;
    total: string;
}

export class StopwatchAppComponent {
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    private _state: StopwatchState = initialStopwatch();
    private _i18nService = di(I18nService);
    private _wakeLockService = di(WakeLockService);
    currentLap = '';
    laps: LapDisplay[] = [];
    primaryClass = 'control start';
    primaryLabel = 'stopwatch.start';
    running = false;
    secondaryDisabled = true;
    secondaryLabel = 'stopwatch.lap';
    time = formatStopwatch(0);

    onInit() {
        // Picks up a stopwatch that was left running.
        this._setState(stopwatchStorage.getItem() || initialStopwatch(), false);
    }

    onDestroy() {
        this._stopFrames();
        this._wakeLockService.release();
    }

    primary() {
        const now = Date.now();
        this._setState(
            isRunning(this._state)
                ? stop(this._state, now)
                : start(this._state, now)
        );
    }

    secondary() {
        if (isRunning(this._state)) {
            this._setState(lap(this._state, Date.now()));
        } else {
            this._setState(reset());
        }
    }

    private _render() {
        const now = Date.now();
        this.time = formatStopwatch(elapsed(this._state, now));
        // Only interesting once there's a lap to compare it with.
        this.currentLap = this._state.laps.length
            ? `${this._i18nService.get('stopwatch.lap')} ${
                  this._state.laps.length + 1
              }: ${formatStopwatch(currentLapMs(this._state, now))}`
            : '';
    }

    private _setState(state: StopwatchState, save = true) {
        this._state = state;

        if (save) {
            stopwatchStorage.setItem(state);
        }

        const running = isRunning(state);
        const started = running || state.accumulatedMs > 0;
        this.running = running;
        this.primaryLabel = running
            ? 'stopwatch.stop'
            : started
              ? 'stopwatch.resume'
              : 'stopwatch.start';
        this.primaryClass = running ? 'control stop' : 'control start';
        this.secondaryLabel = running ? 'stopwatch.lap' : 'stopwatch.reset';
        this.secondaryDisabled = !started;
        this.laps = lapRows(state.laps).map((row) => ({
            className: row.className,
            lap: formatStopwatch(row.lapMs),
            label: row.className.includes('fastest')
                ? 'stopwatch.fastest'
                : row.className.includes('slowest')
                  ? 'stopwatch.slowest'
                  : '',
            number: `${row.number}`,
            total: formatStopwatch(row.totalMs),
        }));
        this._render();

        if (running) {
            this._wakeLockService.request();
            this._startFrames();
        } else {
            this._wakeLockService.release();
            this._stopFrames();
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
}

component(
    'stopwatch-app',
    {
        style: css`
            .wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-4);
                min-height: 100%;
                width: 100%;
                box-sizing: border-box;
            }

            .main {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-4);
                width: 100%;
                padding-top: var(--space-4);
            }

            .time {
                font-size: min(17vw, 5.5rem);
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }

            .current-lap {
                min-height: 1.5rem;
                font-size: 1.25rem;
                color: var(--fg-muted);
                font-variant-numeric: tabular-nums;
            }

            .controls {
                display: flex;
                gap: var(--space-5);
                justify-content: center;
            }

            .control {
                width: 6rem;
                height: 6rem;
                border-radius: 50%;
                border: 2px solid var(--border);
                background: var(--surface);
                color: var(--fg);
                font-family: inherit;
                font-size: 1.15rem;
                font-weight: 700;
                cursor: pointer;
                box-shadow: var(--shadow);
                -webkit-tap-highlight-color: transparent;
                transition:
                    background-color 0.15s,
                    transform 0.1s;
            }

            .control:active {
                transform: scale(0.95);
            }

            .control:focus-visible {
                outline: 3px solid var(--accent);
                outline-offset: 3px;
            }

            .control:disabled {
                opacity: 0.4;
                cursor: default;
            }

            .control.start {
                background: var(--success);
                border-color: var(--success);
                /* --bg contrasts with the status colors in both themes. */
                color: var(--bg);
            }

            .control.stop {
                background: var(--danger);
                border-color: var(--danger);
                color: var(--bg);
            }

            .laps {
                width: 100%;
                max-width: 28rem;
                border-collapse: collapse;
                font-variant-numeric: tabular-nums;
            }

            .laps th {
                font-size: 0.8rem;
                font-weight: 600;
                color: var(--fg-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                text-align: end;
                padding: var(--space-2) var(--space-3);
                border-bottom: 1px solid var(--border);
            }

            .laps td {
                padding: var(--space-2) var(--space-3);
                text-align: end;
                border-bottom: 1px solid var(--border);
                font-size: 1.1rem;
            }

            .laps .num {
                text-align: start;
                color: var(--fg-muted);
            }

            .tag {
                display: block;
                font-size: 0.75rem;
                font-weight: 600;
            }

            .fastest td {
                color: var(--success);
                font-weight: 700;
            }

            .slowest td {
                color: var(--danger);
                font-weight: 700;
            }

            @media (orientation: landscape) {
                .wrapper {
                    flex-direction: row;
                    align-items: flex-start;
                }

                .main {
                    flex: 1 1 55%;
                    position: sticky;
                    top: 0;
                    min-height: 100%;
                    justify-content: center;
                    padding-top: 0;
                }

                .laps {
                    flex: 1 1 45%;
                }
            }
        `,
        template: html`
            <default-layout>
                <div class="wrapper">
                    <div class="main">
                        <div class="time" role="timer">{{time}}</div>
                        <div class="current-lap">{{currentLap}}</div>
                        <div class="controls">
                            <button
                                class="control"
                                .disabled="secondaryDisabled"
                                @click.stop.prevent="secondary()"
                            >
                                <i18n-label
                                    id="{{secondaryLabel}}"
                                    ws=""
                                ></i18n-label>
                            </button>
                            <button
                                class="{{primaryClass}}"
                                @click.stop.prevent="primary()"
                            >
                                <i18n-label
                                    id="{{primaryLabel}}"
                                    ws=""
                                ></i18n-label>
                            </button>
                        </div>
                    </div>
                    <table *if="laps.length" class="laps">
                        <thead>
                            <tr>
                                <th class="num">
                                    <i18n-label
                                        id="stopwatch.lapHeading"
                                        ws=""
                                    ></i18n-label>
                                </th>
                                <th>
                                    <i18n-label
                                        id="stopwatch.lapTime"
                                        ws=""
                                    ></i18n-label>
                                </th>
                                <th>
                                    <i18n-label
                                        id="stopwatch.total"
                                        ws=""
                                    ></i18n-label>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr *for="row of laps" class="{{row.className}}">
                                <td class="num">{{row.number}}</td>
                                <td>
                                    {{row.lap}}
                                    <span *if="row.label" class="tag"
                                        ><i18n-label
                                            id="{{row.label}}"
                                            ws=""
                                        ></i18n-label
                                    ></span>
                                </td>
                                <td>{{row.total}}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </default-layout>
        `,
    },
    StopwatchAppComponent
);
