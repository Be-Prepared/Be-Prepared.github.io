import { AccessState } from '../services/access/access-controller';
import { AlarmSoundService } from '../services/alarm-sound.service';
import {
    addReading,
    classifySensorError,
    delta,
    Detector,
    fieldStrength,
    formatMicrotesla,
    gaugeFraction,
    newDetector,
    strengthFor,
    toneFor,
    zero,
} from './detector';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';
import { magnetometerController, MagnetometerLike } from './magnetometer';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// How often to look again when the tone is silent.
const QUIET_POLL_MS = 150;

export class MetalDetectorAppComponent {
    private _alarmSoundService = di(AlarmSoundService);
    private _controller = magnetometerController();
    private _detector: Detector = newDetector();
    private _i18nService = di(I18nService);
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    private _sensor: MagnetometerLike | null = null;
    private _sensorError: AccessState | null = null;
    private _subject = new Subject();
    private _toneTimer: ReturnType<typeof setTimeout> | null = null;
    private _onError = (event: Event) => this._failed((event as any).error);
    private _onReading = () => this._reading();
    baselineText = '';
    deltaText = '';
    fieldText = '';
    gauge?: HTMLElement;
    gaugeClass = 'gauge-fill';
    screenState = AccessState.CHECKING;
    soundId = 'metalDetector.soundOff';
    soundOn = false;
    strengthId = 'metalDetector.strength.NONE';

    onInit() {
        this._controller.state
            .pipe(takeUntil(this._subject))
            .subscribe((state) => this._updateScreenState(state));
        this._controller.resourceChanges
            .pipe(takeUntil(this._subject))
            .subscribe((sensor) => this._attach(sensor));
        this._controller.init();
        this._render();
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._attach(null);
        this._controller.destroy();
        this._stopTone();
        this._alarmSoundService.stop();

        if (this._frame !== null) {
            cancelAnimationFrame(this._frame);
        }
    }

    grant() {
        this._sensorError = null;
        this._controller.request();
        this._updateScreenState(this._controller.currentState);
    }

    toggleSound() {
        this.soundOn = !this.soundOn;
        this.soundId = this.soundOn
            ? 'metalDetector.soundOn'
            : 'metalDetector.soundOff';

        if (this.soundOn) {
            // Sound only works after a tap, which this is.
            this._alarmSoundService.unlock();
            this._toneTick();
        } else {
            this._stopTone();
        }
    }

    zero() {
        this._detector = zero(this._detector);
        this._render();
    }

    private _attach(sensor: MagnetometerLike | null) {
        if (this._sensor) {
            this._sensor.removeEventListener('reading', this._onReading);
            this._sensor.removeEventListener('error', this._onError);
        }

        this._sensor = sensor;

        if (sensor) {
            this._sensorError = null;
            this._updateScreenState(this._controller.currentState);
            sensor.addEventListener('reading', this._onReading);
            sensor.addEventListener('error', this._onError);
            // A new sensor after returning from the background; the smoothed
            // value is stale but the baseline is still good.
            this._detector = { ...this._detector, smoothed: null };
        }
    }

    // The sensor stopped working after it started.
    private _failed(error: any) {
        this._sensorError = classifySensorError(error);
        this._controller.release();
        this._updateScreenState(this._controller.currentState);
    }

    private _reading() {
        const sensor = this._sensor;

        if (!sensor) {
            return;
        }

        this._detector = addReading(
            this._detector,
            fieldStrength(sensor.x || 0, sensor.y || 0, sensor.z || 0)
        );

        if (this._frame === null) {
            // Readings can arrive faster than the screen refreshes.
            this._frame = requestAnimationFrame(() => {
                this._frame = null;
                this._render();
            });
        }
    }

    private _render() {
        const change = delta(this._detector);
        const fraction = gaugeFraction(change);
        this.fieldText = `${this._i18nService.get(
            'metalDetector.field'
        )} ${formatMicrotesla(this._detector.smoothed)}`;
        this.baselineText = `${this._i18nService.get(
            'metalDetector.baseline'
        )} ${formatMicrotesla(this._detector.baseline)}`;
        this.deltaText = formatMicrotesla(change, true);
        this.strengthId = `metalDetector.strength.${strengthFor(change)}`;
        this.gaugeClass =
            toneFor(change) === null ? 'gauge-fill' : 'gauge-fill active';

        if (this.gauge) {
            this.gauge.style.transform = `scaleX(${fraction})`;
        }
    }

    private _stopTone() {
        if (this._toneTimer !== null) {
            clearTimeout(this._toneTimer);
            this._toneTimer = null;
        }
    }

    private _toneTick() {
        this._stopTone();

        if (!this.soundOn) {
            return;
        }

        const tone =
            this._sensor && toneFor(delta(this._detector));

        if (tone) {
            this._alarmSoundService.beep(
                tone.frequency,
                Math.min(70, tone.interval / 2)
            );
        }

        this._toneTimer = setTimeout(
            () => this._toneTick(),
            tone ? tone.interval : QUIET_POLL_MS
        );
    }

    private _updateScreenState(state: AccessState) {
        this.screenState = this._sensorError || state;
    }
}

component(
    'metal-detector-app',
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

            .side {
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

                .side {
                    flex: 2 1 0;
                    max-width: 22rem;
                }
            }

            .delta {
                font-size: clamp(2.75rem, 14vmin, 6rem);
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }

            .strength {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--fg-muted);
            }

            .gauge {
                width: 100%;
                max-width: 26rem;
                height: 1.75rem;
                border-radius: 999px;
                background: var(--surface-2);
                border: 1px solid var(--border);
                overflow: hidden;
            }

            .gauge-fill {
                height: 100%;
                width: 100%;
                background: var(--fg-muted);
                transform: scaleX(0);
                transform-origin: left center;
                transition: transform 0.1s linear;
            }

            .gauge-fill.active {
                background: var(--accent);
                box-shadow: 0 0 1rem var(--accent-glow);
            }

            .readings {
                display: flex;
                gap: var(--space-4);
                font-size: 0.95rem;
                color: var(--fg-muted);
                font-variant-numeric: tabular-nums;
            }

            .buttons {
                display: flex;
                gap: var(--space-2);
            }

            .buttons pretty-button {
                flex: 1 1 0;
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
                icon="/metal-detector.svg"
                message-id="metalDetector.explainAsk"
                unavailable-id="metalDetector.unavailable"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <default-layout *if="screenState === 'READY'">
                <div class="wrapper">
                    <div class="main">
                        <div class="delta">{{deltaText}}</div>
                        <div class="strength">
                            <i18n-label id="{{strengthId}}" ws=""></i18n-label>
                        </div>
                        <div class="gauge">
                            <div class="{{gaugeClass}}" #ref="gauge"></div>
                        </div>
                        <div class="readings">
                            <span>{{fieldText}}</span>
                            <span>{{baselineText}}</span>
                        </div>
                    </div>
                    <div class="side">
                        <div class="buttons">
                            <pretty-button
                                variant="primary"
                                @click.stop.prevent="zero()"
                                ><i18n-label
                                    id="metalDetector.zero"
                                    ws=""
                                ></i18n-label
                            ></pretty-button>
                            <pretty-button
                                .enabled="soundOn"
                                @click.stop.prevent="toggleSound()"
                                ><i18n-label id="{{soundId}}" ws=""></i18n-label
                            ></pretty-button>
                        </div>
                        <p class="note">
                            <i18n-label
                                id="metalDetector.howTo"
                                ws=""
                            ></i18n-label>
                        </p>
                        <p class="note">
                            <i18n-label
                                id="metalDetector.limits"
                                ws=""
                            ></i18n-label>
                        </p>
                    </div>
                </div>
            </default-layout>
        `,
    },
    MetalDetectorAppComponent
);
