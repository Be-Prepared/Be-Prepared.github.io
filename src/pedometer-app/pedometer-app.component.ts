import { AccessState } from '../services/access/access-controller';
import {
    addFix,
    clampStride,
    elapsed,
    estimateSteps,
    FixResult,
    formatDuration,
    formatPace,
    METERS_PER_MILE,
    newStopwatch,
    newTrack,
    pauseTrack,
    startStopwatch,
    Stopwatch,
    stopStopwatch,
    Track,
} from './track';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import {
    DistanceService,
    DISTANCE_SYSTEMS,
    DistanceSystemDefault,
} from '../services/distance.service';
import { DistanceSystem } from '../datatypes/distance-system';
import { I18nService } from '../i18n/i18n.service';
import {
    GeolocationCoordinateResult,
    GeolocationService,
} from '../services/geolocation.service';
import { strideStorage } from './pedometer-storage';
import { switchMap, takeUntil } from 'rxjs/operators';
import { WakeLockService } from '../services/wake-lock.service';

// Kept in memory (not saved) so a walk survives a trip to another tool, but
// tracking is paused while away.
let savedSession: { track: Track; watch: Stopwatch } | null = null;

export class PedometerAppComponent {
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _lastFixTime = 0;
    private _running = new BehaviorSubject(false);
    private _stride = clampStride(strideStorage.getItem());
    private _subject = new Subject();
    private _timer: ReturnType<typeof setInterval> | null = null;
    private _track: Track = newTrack();
    private _wakeLockService = di(WakeLockService);
    private _watch: Stopwatch = newStopwatch();
    accuracyText = '';
    distanceSystem: DistanceSystem = DistanceSystemDefault;
    distanceSystems = DISTANCE_SYSTEMS;
    distanceText = '';
    paceLabelId = 'pedometer.pacePerMile';
    paceText = '';
    running = false;
    screenState = AccessState.CHECKING;
    speedText = '';
    statusClass = 'status';
    statusId = 'pedometer.status.ready';
    statusText = '';
    stepsText = '';
    strideCm = Math.round(this._stride * 100);
    strideText = '';
    timeText = '';
    toggleId = 'pedometer.start';

    onInit() {
        if (savedSession) {
            this._track = savedSession.track;
            this._watch = savedSession.watch;

            if (this._watch.banked > 0) {
                this.toggleId = 'pedometer.resume';
                this.statusId = 'pedometer.status.paused';
            }
        }

        this._distanceService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((system) => {
                this.distanceSystem = system;
                this._render();
            });

        combineLatest([
            this._geolocationService.availabilityState(),
            this._running,
        ])
            .pipe(
                switchMap(([state, running]) => {
                    this.screenState = state;

                    // GPS only runs while tracking, which saves battery and
                    // means nothing is measured while paused.
                    if (state === AccessState.READY && running) {
                        return this._geolocationService.getPosition();
                    }

                    return of(null);
                }),
                // Last, so the position watch is stopped too.
                takeUntil(this._subject)
            )
            .subscribe((result) => this._position(result));
    }

    onDestroy() {
        this._pause();
        savedSession = { track: this._track, watch: this._watch };
        this._subject.next(null);
        this._subject.complete();
        this._running.complete();
    }

    changeDistanceSystem(value: DistanceSystem) {
        this._distanceService.setDistanceSystem(value);
    }

    grant() {
        this._geolocationService.request();
    }

    reset() {
        this._track = newTrack();
        this._watch = this.running
            ? startStopwatch(newStopwatch(), Date.now())
            : newStopwatch();
        this.accuracyText = '';

        if (!this.running) {
            this.toggleId = 'pedometer.start';
            this._setStatus('pedometer.status.ready');
        }

        this._render();
    }

    strideInput(value: string) {
        this._stride = clampStride(parseFloat(value) / 100);
        this.strideCm = Math.round(this._stride * 100);
        strideStorage.setItem(this._stride);
        this._render();
    }

    toggle() {
        if (this.running) {
            this._pause();
            this.toggleId = 'pedometer.resume';
            this._setStatus('pedometer.status.paused');
            this._render();

            return;
        }

        this.running = true;
        this.toggleId = 'pedometer.pause';
        this._setStatus('pedometer.status.waiting');
        this._watch = startStopwatch(this._watch, Date.now());
        this._wakeLockService.request();
        this._timer = setInterval(() => this._render(), 1000);
        this._running.next(true);
        this._render();
    }

    private _pause() {
        if (!this.running) {
            return;
        }

        this.running = false;
        this._watch = stopStopwatch(this._watch, Date.now());
        this._track = pauseTrack(this._track);
        this._wakeLockService.release();

        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }

        if (!this._running.closed) {
            this._running.next(false);
        }
    }

    private _position(result: GeolocationCoordinateResult | null) {
        if (!result || !this.running) {
            return;
        }

        if (!result.success) {
            this._setStatus('pedometer.status.noSignal');
            this._render();

            return;
        }

        // The GPS service replays its last fix to new subscribers. That one
        // was already handled, or is from before resuming.
        if (result.timestamp <= this._lastFixTime) {
            return;
        }

        this._lastFixTime = result.timestamp;
        this.accuracyText = `±${this._distanceService.metersToString(
            result.accuracy,
            { useSmallUnits: true }
        )}`;
        const next = addFix(this._track, {
            lat: result.lat,
            lon: result.lon,
            accuracy: result.accuracy,
            timestamp: result.timestamp,
        });
        this._track = next.track;
        this._setStatus(
            next.result === FixResult.INACCURATE
                ? 'pedometer.status.weak'
                : 'pedometer.status.tracking'
        );
        this._render();
    }

    private _render() {
        const meters = this._track.distance;
        const ms = elapsed(this._watch, Date.now());
        const metric = this.distanceSystem === DistanceSystem.METRIC;
        this.distanceText = this._distanceService.metersToString(meters);
        this.timeText = formatDuration(ms);
        this.paceLabelId = metric
            ? 'pedometer.pacePerKm'
            : 'pedometer.pacePerMile';
        this.paceText =
            formatPace(meters, ms, metric ? 1000 : METERS_PER_MILE) || '—';
        this.speedText =
            ms > 0 && meters >= 10
                ? this._distanceService.metersToString(meters / (ms / 1000), {
                      isSpeed: true,
                  })
                : '—';
        this.stepsText = `≈ ${estimateSteps(
            meters,
            this._stride
        ).toLocaleString()}`;
        this.statusText = this._i18nService.get(this.statusId);

        if (this.accuracyText) {
            this.statusText += ` · ${this._i18nService.get(
                'pedometer.accuracy'
            )} ${this.accuracyText}`;
        }

        this.strideText = metric
            ? `${Math.round(this._stride * 100)} cm`
            : `${Math.round(this._stride * 39.37)} in`;
    }

    private _setStatus(id: string) {
        this.statusId = id;
        this.statusClass =
            id === 'pedometer.status.weak' || id === 'pedometer.status.noSignal'
                ? 'status warn'
                : 'status';
    }
}

component(
    'pedometer-app',
    {
        style: css`
            .wrapper {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
                min-height: 100%;
                box-sizing: border-box;
            }

            .main {
                flex: 1 1 auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: var(--space-3);
                text-align: center;
            }

            .controls {
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
            }

            @media (orientation: landscape) {
                .wrapper {
                    flex-direction: row;
                    align-items: center;
                }

                .main {
                    flex: 3 1 0;
                }

                .controls {
                    flex: 2 1 0;
                    max-width: 22rem;
                }
            }

            .distance {
                font-size: clamp(2.75rem, 15vmin, 6.5rem);
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }

            .caption {
                color: var(--fg-muted);
                font-size: 0.95rem;
            }

            .stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--space-2) var(--space-4);
                width: 100%;
                max-width: 24rem;
            }

            .stat {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: var(--space-2);
                border-radius: var(--radius-m);
                background: var(--surface);
                border: 1px solid var(--border);
            }

            .value {
                font-size: 1.5rem;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
            }

            .status {
                font-size: 0.95rem;
                color: var(--fg-muted);
            }

            .status.warn {
                color: var(--warning);
                font-weight: 600;
            }

            .setting {
                display: flex;
                align-items: center;
                gap: var(--space-3);
                font-size: 0.95rem;
            }

            .setting input {
                flex: 1 1 auto;
                min-width: 0;
                accent-color: var(--accent);
            }

            .note {
                margin: 0;
                font-size: 0.85rem;
                color: var(--fg-muted);
            }
        `,
        template: html`
            <access-screen
                *if="screenState !== 'READY'"
                state="{{screenState}}"
                icon="/location.svg"
                message-id="pedometer.explainAsk"
                unavailable-id="pedometer.unavailable"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <default-layout *if="screenState === 'READY'">
                <icon-button
                    slot="more-buttons"
                    href="/reset.svg"
                    label-id="pedometer.reset"
                    .disabled="running"
                    @click.stop.prevent="reset()"
                ></icon-button>
                <div class="wrapper">
                    <div class="main">
                        <div class="distance">{{distanceText}}</div>
                        <div class="stats">
                            <div class="stat">
                                <span class="value">{{timeText}}</span>
                                <span class="caption"
                                    ><i18n-label
                                        id="pedometer.time"
                                        ws=""
                                    ></i18n-label
                                ></span>
                            </div>
                            <div class="stat">
                                <span class="value">{{stepsText}}</span>
                                <span class="caption"
                                    ><i18n-label
                                        id="pedometer.steps"
                                        ws=""
                                    ></i18n-label
                                ></span>
                            </div>
                            <div class="stat">
                                <span class="value">{{paceText}}</span>
                                <span class="caption"
                                    ><i18n-label
                                        id="{{paceLabelId}}"
                                        ws=""
                                    ></i18n-label
                                ></span>
                            </div>
                            <div class="stat">
                                <span class="value">{{speedText}}</span>
                                <span class="caption"
                                    ><i18n-label
                                        id="pedometer.speed"
                                        ws=""
                                    ></i18n-label
                                ></span>
                            </div>
                        </div>
                        <div class="{{statusClass}}">{{statusText}}</div>
                    </div>
                    <div class="controls">
                        <pretty-button
                            variant="primary"
                            @click.stop.prevent="toggle()"
                            ><i18n-label id="{{toggleId}}" ws=""></i18n-label
                        ></pretty-button>
                        <label class="setting">
                            <i18n-label id="pedometer.stride" ws=""></i18n-label>
                            <input
                                type="range"
                                min="30"
                                max="150"
                                step="1"
                                value="{{strideCm}}"
                                @input="strideInput($event.target.value)"
                            />
                            <span>{{strideText}}</span>
                        </label>
                        <div class="setting">
                            <i18n-label id="pedometer.units" ws=""></i18n-label>
                            <pretty-select
                                i18n-base="info.distances"
                                value="{{distanceSystem}}"
                                .options="distanceSystems"
                                @change="changeDistanceSystem($event.detail)"
                            ></pretty-select>
                        </div>
                        <p class="note">
                            <i18n-label id="pedometer.note" ws=""></i18n-label>
                        </p>
                    </div>
                </div>
            </default-layout>
        `,
    },
    PedometerAppComponent
);
