import { AccessState } from '../services/access/access-controller';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { MicrophoneService } from '../services/microphone.service';
import {
    aWeightingPowerGains,
    dbfsToSpl,
    findCategoryIndex,
    formatDb,
    formatRange,
    LevelStats,
    meanSquare,
    meanSquareToDbfs,
    smooth,
    SOUND_CATEGORIES,
    weightingCorrectionDb,
} from './sound-math';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface CategoryRow {
    className: string;
    labelId: string;
    range: string;
}

// The meter bar covers this range.
const METER_MAX_DB = 130;

// The big number changes this often. Updating every frame makes it
// unreadable.
const TEXT_INTERVAL_MS = 250;

export class SoundLevelAppComponent {
    private _activeIndex = -2;
    private _analyser: AnalyserNode | null = null;
    private _context: AudioContext | null = null;
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    private _gains: Float32Array | null = null;
    private _lastFrameTime: number | null = null;
    private _lastTextTime = 0;
    private _level: number | null = null;
    private _mic = di(MicrophoneService).controller();
    private _source: MediaStreamAudioSourceNode | null = null;
    private _spectrum: Float32Array<ArrayBuffer> | null = null;
    private _smoothed: number | null = null;
    private _stats = new LevelStats();
    private _subject = new Subject();
    private _timeData: Float32Array<ArrayBuffer> | null = null;
    average = '–';
    level = '–';
    max = '–';
    meterFill?: HTMLElement;
    min = '–';
    needsTap = false;
    rows: CategoryRow[] = [];
    screenState = AccessState.CHECKING;

    onInit() {
        this._updateRows(-1);
        this._mic.state
            .pipe(takeUntil(this._subject))
            .subscribe((state) => (this.screenState = state));
        // The controller releases the microphone while the app is hidden
        // and hands over a new stream when it comes back.
        this._mic.resourceChanges
            .pipe(takeUntil(this._subject))
            .subscribe((stream) => this._attach(stream));
        this._mic.init();
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._stopAnalysis();
        this._mic.destroy();

        if (this._context) {
            this._context.close().catch(() => {});
            this._context = null;
        }
    }

    grant() {
        this._mic.request();
    }

    reset() {
        this._stats.reset();
        this._updateText();
    }

    // Browsers may refuse to start audio processing until the page is
    // tapped.
    resumeAudio() {
        this._context
            ?.resume()
            .catch(() => {})
            .then(() => this._checkSuspended());
    }

    private _attach(stream: MediaStream | null) {
        this._stopAnalysis();

        if (!stream) {
            this._context?.suspend().catch(() => {});

            return;
        }

        const Context =
            window.AudioContext || (window as any).webkitAudioContext;

        if (!Context) {
            this.screenState = AccessState.UNAVAILABLE;

            return;
        }

        if (!this._context) {
            this._context = new Context();
        }

        const context = this._context;
        const analyser = context.createAnalyser();
        // About 43 ms of audio at 48 kHz, long enough for low frequencies.
        analyser.fftSize = 2048;
        // Smoothing is done here with a proper time constant instead.
        analyser.smoothingTimeConstant = 0;
        this._source = context.createMediaStreamSource(stream);
        // Not connected to the speakers, so there's no feedback.
        this._source.connect(analyser);
        this._analyser = analyser;
        this._timeData = new Float32Array(analyser.fftSize);
        this._spectrum = new Float32Array(analyser.frequencyBinCount);
        this._gains = aWeightingPowerGains(
            analyser.frequencyBinCount,
            context.sampleRate,
            analyser.fftSize
        );
        this._smoothed = null;
        this._lastFrameTime = null;
        context
            .resume()
            .catch(() => {})
            .then(() => this._checkSuspended());
        this._frame = requestAnimationFrame((time) => this._tick(time));
    }

    private _checkSuspended() {
        this.needsTap = !!this._context && this._context.state !== 'running';
    }

    private _stopAnalysis() {
        if (this._frame !== null) {
            cancelAnimationFrame(this._frame);
            this._frame = null;
        }

        this._source?.disconnect();
        this._source = null;
        this._analyser?.disconnect();
        this._analyser = null;
    }

    private _tick(time: number) {
        this._frame = requestAnimationFrame((next) => this._tick(next));
        const analyser = this._analyser;

        if (
            !analyser ||
            !this._timeData ||
            !this._spectrum ||
            !this._gains ||
            this._context?.state !== 'running'
        ) {
            return;
        }

        analyser.getFloatTimeDomainData(this._timeData);
        analyser.getFloatFrequencyData(this._spectrum);
        const raw = meanSquare(this._timeData);

        if (raw === 0 && this._smoothed === null) {
            // Exact digital silence means audio isn't flowing yet. Real
            // microphones always pick up some noise.
            return;
        }

        const correction = weightingCorrectionDb(this._spectrum, this._gains);
        const weighted = raw * Math.pow(10, correction / 10);
        const elapsed =
            this._lastFrameTime === null ? 0 : time - this._lastFrameTime;
        this._lastFrameTime = time;
        this._smoothed = smooth(this._smoothed, weighted, elapsed);
        this._level = dbfsToSpl(meanSquareToDbfs(this._smoothed));
        this._stats.add(this._level);

        if (this.meterFill) {
            // Clipped rather than scaled so the colors stay at fixed levels.
            const percent = Math.min(100, (this._level / METER_MAX_DB) * 100);
            this.meterFill.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
        }

        if (time - this._lastTextTime >= TEXT_INTERVAL_MS) {
            this._lastTextTime = time;
            this._updateText();
        }
    }

    private _updateRows(activeIndex: number) {
        if (activeIndex === this._activeIndex) {
            return;
        }

        this._activeIndex = activeIndex;
        this.rows = SOUND_CATEGORIES.map((category, index) => ({
            className: index === activeIndex ? 'row active' : 'row',
            labelId: `soundLevel.category.${category.id}`,
            range: formatRange(category),
        }));
    }

    private _updateText() {
        this.level = formatDb(this._level);
        this.min = formatDb(this._stats.count ? this._stats.min : null);
        this.average = formatDb(this._stats.average());
        this.max = formatDb(this._stats.count ? this._stats.max : null);
        this._updateRows(
            this._level === null ? -1 : findCategoryIndex(this._level)
        );
    }
}

component(
    'sound-level-app',
    {
        style: css`
            .wrapper {
                /* Rows change height when highlighted. Without this the
                   browser scrolls the list to keep a row in place. */
                overflow-anchor: none;
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
                /* Grows with the list so the reading can stick. */
                min-height: 100%;
                width: 100%;
                box-sizing: border-box;
            }

            /* Stays in view while the list scrolls. */
            .reading {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-3);
                flex-shrink: 0;
                position: sticky;
                top: 0;
                z-index: 1;
                background: var(--bg);
                padding-bottom: var(--space-2);
            }

            .current {
                display: flex;
                align-items: baseline;
                gap: var(--space-2);
            }

            .value {
                font-size: 5rem;
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }

            .unit {
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--fg-muted);
            }

            .meter {
                width: 100%;
                max-width: 24rem;
                height: 0.9rem;
                border-radius: 999px;
                background: var(--surface-2);
                border: 1px solid var(--border);
                overflow: hidden;
            }

            .fill {
                height: 100%;
                width: 100%;
                clip-path: inset(0 100% 0 0);
                /* Green for safe, amber from 70 dB, red from 85 dB. */
                background: linear-gradient(
                    to right,
                    var(--success) 0%,
                    var(--success) 54%,
                    var(--warning) 54%,
                    var(--warning) 65%,
                    var(--danger) 65%
                );
            }

            .stats {
                display: flex;
                gap: var(--space-3);
                width: 100%;
                max-width: 24rem;
            }

            .stat {
                flex: 1 1 0;
                text-align: center;
                padding: var(--space-2);
                border-radius: var(--radius-m);
                background: var(--surface);
                border: 1px solid var(--border);
            }

            .stat-label {
                font-size: 0.8rem;
                color: var(--fg-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
            }

            .note {
                margin: 0;
                font-size: 0.85rem;
                color: var(--fg-muted);
                text-align: center;
                max-width: 24rem;
            }

            .categories {
                list-style: none;
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
                width: 100%;
                max-width: 32rem;
                align-self: center;
                padding-bottom: var(--space-4);
            }

            .row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: var(--space-3);
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-m);
                border: 1px solid transparent;
                color: var(--fg-muted);
                transition:
                    background-color 0.2s,
                    color 0.2s;
            }

            .row.active {
                background: var(--accent-soft);
                border-color: var(--accent);
                color: var(--fg);
                font-weight: 600;
            }

            .range {
                flex-shrink: 0;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }

            @media (orientation: landscape) {
                .wrapper {
                    flex-direction: row;
                    align-items: flex-start;
                }

                .reading {
                    flex: 1 1 50%;
                }

                .categories {
                    flex: 1 1 50%;
                    align-self: flex-start;
                }
            }
        `,
        template: html`
            <access-screen
                *if="screenState !== 'READY'"
                state="{{screenState}}"
                icon="/sound-level.svg"
                message-id="soundLevel.explainAsk"
                unavailable-id="soundLevel.unavailable"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <default-layout *if="screenState === 'READY'">
                <icon-button
                    slot="more-buttons"
                    href="/reset.svg"
                    label-id="soundLevel.reset"
                    @click.stop.prevent="reset()"
                ></icon-button>
                <div class="wrapper">
                    <section class="reading">
                        <div class="current" aria-live="polite">
                            <span class="value">{{level}}</span>
                            <span class="unit">dBA</span>
                        </div>
                        <div class="meter">
                            <div class="fill" #ref="meterFill"></div>
                        </div>
                        <div class="stats">
                            <div class="stat">
                                <div class="stat-label">
                                    <i18n-label
                                        id="soundLevel.min"
                                        ws=""
                                    ></i18n-label>
                                </div>
                                <div class="stat-value">{{min}}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">
                                    <i18n-label
                                        id="soundLevel.average"
                                        ws=""
                                    ></i18n-label>
                                </div>
                                <div class="stat-value">{{average}}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">
                                    <i18n-label
                                        id="soundLevel.max"
                                        ws=""
                                    ></i18n-label>
                                </div>
                                <div class="stat-value">{{max}}</div>
                            </div>
                        </div>
                        <pretty-button
                            *if="needsTap"
                            variant="primary"
                            @click.stop.prevent="resumeAudio()"
                            ><i18n-label
                                id="soundLevel.tapToStart"
                                ws=""
                            ></i18n-label
                        ></pretty-button>
                        <p class="note">
                            <i18n-label
                                id="soundLevel.approximate"
                                ws=""
                            ></i18n-label>
                        </p>
                    </section>
                    <ul class="categories">
                        <li *for="row of rows" class="{{row.className}}">
                            <span class="name"
                                ><i18n-label
                                    id="{{row.labelId}}"
                                    ws=""
                                ></i18n-label
                            ></span>
                            <span class="range">{{row.range}}</span>
                        </li>
                    </ul>
                </div>
            </default-layout>
        `,
    },
    SoundLevelAppComponent
);
