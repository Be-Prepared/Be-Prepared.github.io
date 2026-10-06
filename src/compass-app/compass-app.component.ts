import { AccessState } from '../services/access/access-controller';
import { CalibrationStatus } from '../services/compass/calibration-monitor';
import {
    CompassService,
    CompassState,
    CompassUpdate,
} from '../services/compass.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { DirectionService } from '../services/direction.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

function toAccessState(state: CompassState) {
    switch (state) {
        case CompassState.PROMPT:
            return AccessState.PROMPT;

        case CompassState.DENIED:
            return AccessState.DENIED;

        case CompassState.UNAVAILABLE:
            return AccessState.UNAVAILABLE;

        case CompassState.STARTING:
            return AccessState.CHECKING;

        default:
            return AccessState.READY;
    }
}

export class CompassAppComponent {
    private _compassService = di(CompassService);
    private _directionService = di(DirectionService);
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    private _latest: CompassUpdate | null = null;
    private _rotation = 0;
    private _subject = new Subject();
    accuracy = '';
    compassRose?: HTMLElement;
    compassPoint = '';
    degrees = '';
    needsCalibration = false;
    screenState = AccessState.CHECKING;
    sourceId = '';
    waiting = false;

    onInit() {
        this._compassService
            .watch()
            .pipe(takeUntil(this._subject))
            .subscribe((update) => {
                this._latest = update;

                if (this._frame === null) {
                    // Sensors can fire far faster than the screen refreshes.
                    this._frame = requestAnimationFrame(() => {
                        this._frame = null;
                        this._render();
                    });
                }
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();

        if (this._frame !== null) {
            cancelAnimationFrame(this._frame);
        }
    }

    grant() {
        this._compassService.requestPermission();
    }

    private _render() {
        const update = this._latest;

        if (!update) {
            return;
        }

        this.screenState = toAccessState(update.state);
        this.waiting = update.state === CompassState.WAITING;
        this.needsCalibration =
            update.state === CompassState.READY &&
            update.calibration === CalibrationStatus.POOR;
        this.sourceId = `compass.source.${update.source}`;
        this.accuracy =
            update.accuracy !== null && update.accuracy >= 0
                ? `±${Math.round(update.accuracy)}°`
                : '';

        if (update.state !== CompassState.READY || !isFinite(update.bearing)) {
            this.degrees = '';
            this.compassPoint = '';

            return;
        }

        const rounded = this._directionService.standardize360(
            Math.round(update.bearing)
        );
        this.degrees = `${rounded}°`;
        this.compassPoint = this._directionService.toCompassPoint(rounded, 2);

        // Track total rotation instead of jumping from 359 to 0, so the rose
        // never spins the long way around.
        const target = -update.bearing;
        let diff = (target - this._rotation) % 360;

        if (diff > 180) {
            diff -= 360;
        } else if (diff < -180) {
            diff += 360;
        }

        this._rotation += diff;

        if (this.compassRose) {
            this.compassRose.style.transform = `rotate(${this._rotation}deg)`;
        }
    }
}

component(
    'compass-app',
    {
        style: css`
            .wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-evenly;
                gap: var(--space-3);
                height: 100%;
                width: 100%;
                overflow: hidden;
            }

            @media (orientation: landscape) {
                .wrapper {
                    flex-direction: row;
                }
            }

            .dial {
                position: relative;
                width: min(88vmin, 30rem);
                aspect-ratio: 1 / 1;
                flex-shrink: 1;
            }

            .compass-rose {
                width: 100%;
                height: 100%;
            }

            .lubber {
                position: absolute;
                top: -0.6rem;
                left: 50%;
                width: 0;
                height: 0;
                transform: translateX(-50%);
                border-left: 0.7rem solid transparent;
                border-right: 0.7rem solid transparent;
                border-top: 1.2rem solid var(--fg);
            }

            .info {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                min-width: 12rem;
                gap: var(--space-2);
                text-align: center;
            }

            .degrees {
                font-size: 4rem;
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }

            .point {
                font-size: 1.75rem;
                color: var(--fg-muted);
                font-weight: 600;
            }

            .meta {
                font-size: 0.85rem;
                color: var(--fg-muted);
            }

            .notice {
                display: flex;
                gap: var(--space-3);
                align-items: center;
                max-width: 22rem;
                padding: var(--space-3);
                border-radius: var(--radius-m);
                background: var(--warning-bg);
                border: 1px solid var(--warning);
                text-align: left;
                font-size: 0.95rem;
            }

            .notice load-svg {
                width: 3rem;
                height: 3rem;
                flex-shrink: 0;
                color: var(--warning);
            }
        `,
        template: html`
            <access-screen
                *if="screenState !== 'READY'"
                state="{{screenState}}"
                icon="/compass.svg"
                message-id="compass.explainAsk"
                unavailable-id="compass.unavailable"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <default-layout *if="screenState === 'READY'">
                <div class="wrapper">
                    <div class="dial">
                        <load-svg
                            class="compass-rose"
                            href="/compass-rose.svg"
                            #ref="compassRose"
                        ></load-svg>
                        <div class="lubber"></div>
                    </div>
                    <div class="info">
                        <div class="degrees">{{degrees}}</div>
                        <div class="point">{{compassPoint}}</div>
                        <div *if="waiting" class="notice">
                            <load-svg href="/warning.svg"></load-svg>
                            <i18n-label id="compass.waiting" ws=""></i18n-label>
                        </div>
                        <div *if="needsCalibration" class="notice">
                            <load-svg href="/calibrate.svg"></load-svg>
                            <i18n-label
                                id="compass.calibrate"
                                ws=""
                            ></i18n-label>
                        </div>
                        <div class="meta">
                            <i18n-label id="{{sourceId}}" ws=""></i18n-label>
                            {{accuracy}}
                        </div>
                    </div>
                </div>
            </default-layout>
        `,
    },
    CompassAppComponent
);
