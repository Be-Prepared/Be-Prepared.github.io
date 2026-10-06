import { AccessState } from '../services/access/access-controller';
import {
    barDirection,
    barReading,
    calibrate,
    canCalibrate,
    defaultOffsets,
    formatDegrees,
    formatSignedDegrees,
    hasOffset,
    isTooFlat,
    LevelMode,
    LevelOffsets,
    nextIsLevel,
    resetOffset,
    surfaceBubble,
    surfaceReading,
    vialBubble,
} from './level-math';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { levelModeStorage, levelOffsetsStorage } from './level-storage';
import { MotionService } from '../services/motion.service';
import { smoothVector, Vector3 } from '../services/motion/motion-math';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastService } from '../services/toast.service';
import { WakeLockService } from '../services/wake-lock.service';

// Fraction of each new reading to blend in. Lower is calmer but laggier.
const SMOOTHING = 0.2;

// How far the bubble's center can travel, in percent of the target or vial.
const SURFACE_TRAVEL = 38;
const BAR_TRAVEL = 41;

export class LevelAppComponent {
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    private _gravity: Vector3 | null = null;
    private _isLevel = false;
    private _isVerticalLevel = false;
    private _motionService = di(MotionService);
    private _offsets: LevelOffsets =
        levelOffsetsStorage.getItem() || defaultOffsets();
    private _subject = new Subject();
    private _toastService = di(ToastService);
    private _wakeLockService = di(WakeLockService);
    horizontalBubbleEl?: HTMLElement;
    canCalibrate = false;
    canReset = false;
    degrees = '';
    detailX = '';
    detailY = '';
    hintId = '';
    mode: LevelMode = levelModeStorage.getItem() || 'surface';
    modeClass = { surface: '', bars: '' };
    modePressed = { surface: 'false', bars: 'false' };
    screenState = AccessState.CHECKING;
    stateClass = 'level-app';
    statusId = '';
    surfaceBubbleEl?: HTMLElement;
    verticalBubbleEl?: HTMLElement;
    verticalClass = 'vial vertical';
    verticalDegrees = '';
    waiting = false;

    onInit() {
        this._setMode(this.mode);
        this._wakeLockService.request();
        this._motionService
            .watch()
            .pipe(takeUntil(this._subject))
            .subscribe((update) => {
                this.screenState = update.state;
                this.waiting = update.waiting || !update.gravity;

                if (update.gravity) {
                    // Smooth per reading rather than per frame so the feel
                    // doesn't depend on the screen's refresh rate.
                    this._gravity = smoothVector(
                        this._gravity,
                        update.gravity,
                        SMOOTHING
                    );
                }

                this._scheduleRender();
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._wakeLockService.release();

        if (this._frame !== null) {
            cancelAnimationFrame(this._frame);
        }
    }

    calibrate() {
        if (!this._gravity) {
            return;
        }

        this._saveOffsets(calibrate(this.mode, this._gravity, this._offsets));
        this._toastService.popI18n('level.zeroSaved');
    }

    grant() {
        this._motionService.requestPermission();
    }

    resetCalibration() {
        this._saveOffsets(resetOffset(this.mode, this._offsets));
        this._toastService.popI18n('level.zeroCleared');
    }

    selectMode(mode: LevelMode) {
        this._setMode(mode);
        levelModeStorage.setItem(mode);
    }

    private _render() {
        const gravity = this._gravity;
        this.canCalibrate = !!gravity;
        this.canReset = hasOffset(this.mode, this._offsets);

        if (!gravity) {
            this.degrees = '';
            this.detailX = '';
            this.detailY = '';
            this.hintId = '';
            this.statusId = '';
            this._setLevel(false);

            return;
        }

        if (this.mode === 'surface') {
            this._renderSurface(gravity);
        } else {
            this._renderBar(gravity);
        }
    }

    private _renderBar(gravity: Vector3) {
        const reading = barReading(gravity, this._offsets.bars);
        this.detailX = '';
        this.detailY = '';
        this.hintId = '';
        this.canCalibrate = canCalibrate('bars', gravity);

        // The horizontal vial drives the big number: it's the one that
        // matters when the phone stands on an edge.
        this._setLevel(nextIsLevel(this._isLevel, reading.x));
        this.degrees = formatDegrees(reading.x);
        const direction = barDirection(reading.x);
        this.statusId =
            this._isLevel || !direction
                ? 'level.status.level'
                : `level.status.${direction}`;

        this._isVerticalLevel = nextIsLevel(this._isVerticalLevel, reading.y);
        this.verticalClass = this._isVerticalLevel
            ? 'vial vertical is-level'
            : 'vial vertical';
        this.verticalDegrees = formatDegrees(reading.y);

        if (this.horizontalBubbleEl) {
            this.horizontalBubbleEl.style.left = `${50 + vialBubble(reading.x) * BAR_TRAVEL}%`;
        }

        if (this.verticalBubbleEl) {
            // +1 is the top of the vial; CSS top grows downward.
            this.verticalBubbleEl.style.top = `${50 - vialBubble(reading.y) * BAR_TRAVEL}%`;
        }
    }

    private _renderSurface(gravity: Vector3) {
        const reading = surfaceReading(gravity, this._offsets.surface);
        this.degrees = formatDegrees(reading.total);
        this.detailX = formatSignedDegrees(reading.x);
        this.detailY = formatSignedDegrees(reading.y);
        this.hintId = isTooFlat(gravity) ? '' : 'level.hint.layFlat';
        this.canCalibrate = canCalibrate('surface', gravity);
        this._setLevel(
            !this.hintId && nextIsLevel(this._isLevel, reading.total)
        );
        this.statusId = this._isLevel ? 'level.status.level' : '';

        if (this.surfaceBubbleEl) {
            const bubble = surfaceBubble(reading);
            this.surfaceBubbleEl.style.left = `${50 + bubble.x * SURFACE_TRAVEL}%`;
            this.surfaceBubbleEl.style.top = `${50 + bubble.y * SURFACE_TRAVEL}%`;
        }
    }

    private _saveOffsets(offsets: LevelOffsets) {
        this._offsets = offsets;
        levelOffsetsStorage.setItem(offsets);
        this._isLevel = false;
        this._scheduleRender();
    }

    private _scheduleRender() {
        if (this._frame === null) {
            // Sensors can fire far faster than the screen refreshes.
            this._frame = requestAnimationFrame(() => {
                this._frame = null;
                this._render();
            });
        }
    }

    private _setLevel(isLevel: boolean) {
        if (isLevel && !this._isLevel && navigator.vibrate) {
            navigator.vibrate(30);
        }

        this._isLevel = isLevel;
        this.stateClass = isLevel ? 'level-app is-level' : 'level-app';
    }

    private _setMode(mode: LevelMode) {
        this.mode = mode;
        this.modeClass = {
            surface: mode === 'surface' ? 'active' : '',
            bars: mode === 'bars' ? 'active' : '',
        };
        this.modePressed = {
            surface: `${mode === 'surface'}`,
            bars: `${mode === 'bars'}`,
        };
        // Don't buzz just because the mode changed.
        this._isLevel = false;
        this._isVerticalLevel = false;
        this._setLevel(false);
        // The gauge for the new mode is drawn a tick later.
        setTimeout(() => this._scheduleRender());
    }
}

component(
    'level-app',
    {
        style: css`
            .level-app {
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
                height: 100%;
                width: 100%;
                box-sizing: border-box;
                overflow: hidden;
            }

            .modes {
                display: flex;
                align-self: center;
                width: 100%;
                max-width: 26rem;
                padding: 3px;
                gap: 3px;
                border-radius: 999px;
                background: var(--surface-2);
                border: 1px solid var(--border);
                box-sizing: border-box;
                flex-shrink: 0;
            }

            .modes button {
                flex: 1 1 0;
                min-height: 2.5rem;
                border: none;
                border-radius: 999px;
                background: transparent;
                color: var(--fg-muted);
                font: inherit;
                font-weight: 600;
                cursor: pointer;
                padding: var(--space-1) var(--space-2);
            }

            .modes button.active {
                background: var(--accent);
                color: var(--accent-fg);
            }

            .modes button:focus-visible {
                outline: 3px solid var(--accent);
                outline-offset: 2px;
            }

            .body {
                flex: 1 1 auto;
                min-height: 0;
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
            }

            @media (orientation: landscape) {
                .body {
                    flex-direction: row;
                }
            }

            .stage {
                flex: 1 1 auto;
                min-height: 0;
                min-width: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                container-type: size;
            }

            .target {
                position: relative;
                width: min(94cqw, 94cqh, 26rem);
                aspect-ratio: 1 / 1;
                color: var(--fg-muted);
            }

            .target svg {
                display: block;
                width: 100%;
                height: 100%;
            }

            .face {
                fill: var(--surface);
                stroke: var(--border);
                stroke-width: 1;
            }

            .ring {
                fill: none;
                stroke: var(--border);
                stroke-width: 0.6;
            }

            .cross {
                stroke: var(--fg-muted);
                stroke-width: 0.4;
            }

            .zone {
                fill: none;
                stroke: var(--fg-muted);
                stroke-width: 0.8;
            }

            .bubble {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 18%;
                aspect-ratio: 1 / 1;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                background:
                    radial-gradient(
                        circle at 35% 35%,
                        #fff8 0 18%,
                        transparent 20%
                    ),
                    var(--accent);
                opacity: 0.85;
                box-shadow: 0 0 0 2px var(--accent-glow);
                pointer-events: none;
            }

            /* Construction level: a horizontal vial and, beside it, a
               vertical one. They never cross. */
            .bars {
                display: flex;
                align-items: stretch;
                gap: var(--space-4);
                width: 100%;
                height: 100%;
                max-width: 34rem;
            }

            .horizontal-slot {
                flex: 1 1 auto;
                min-width: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .vertical-slot {
                flex: 0 0 auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-2);
                min-height: 0;
            }

            .vial {
                position: relative;
                background: var(--surface);
                border: 2px solid var(--border);
                border-radius: 999px;
                box-shadow: inset 0 0.25rem 0.75rem var(--shadow);
                overflow: hidden;
            }

            .vial.horizontal {
                width: 100%;
                height: min(4.5rem, 30cqh);
            }

            .vial.vertical {
                flex: 1 1 auto;
                width: min(4.5rem, 18cqw);
                min-height: 8rem;
                max-height: 26rem;
            }

            .vial .bubble {
                border-radius: 999px;
                aspect-ratio: auto;
            }

            .vial.horizontal .bubble {
                width: 18%;
                height: 70%;
            }

            .vial.vertical .bubble {
                width: 70%;
                height: 18%;
            }

            .tick {
                position: absolute;
                background: var(--fg-muted);
            }

            .horizontal .tick {
                top: 0;
                bottom: 0;
                width: 2px;
                margin-left: -1px;
            }

            .vertical .tick {
                left: 0;
                right: 0;
                height: 2px;
                margin-top: -1px;
            }

            .horizontal .tick.minor {
                top: 25%;
                bottom: 25%;
                background: var(--border);
            }

            .vertical .tick.minor {
                left: 25%;
                right: 25%;
                background: var(--border);
            }

            .vial-degrees {
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                color: var(--fg-muted);
            }

            .vial.vertical.is-level {
                border-color: var(--success);
            }

            .vial.vertical.is-level .bubble {
                background-color: var(--success);
                box-shadow: none;
            }

            .is-level .target .bubble,
            .is-level .horizontal .bubble {
                background-color: var(--success);
                box-shadow: none;
            }

            .is-level .face,
            .is-level .vial.horizontal {
                stroke: var(--success);
                border-color: var(--success);
            }

            .readout {
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: var(--space-1);
                text-align: center;
                min-height: 7.5rem;
            }

            @media (orientation: landscape) {
                .readout {
                    min-width: 12rem;
                }
            }

            .degrees {
                font-size: 3.5rem;
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }

            .is-level .degrees,
            .is-level .status {
                color: var(--success);
            }

            .status {
                font-size: 1.25rem;
                font-weight: 600;
                min-height: 1.5rem;
            }

            .axes {
                display: flex;
                gap: var(--space-4);
                color: var(--fg-muted);
                font-variant-numeric: tabular-nums;
            }

            .axes span {
                display: flex;
                gap: 0.35em;
            }

            .axes b {
                color: var(--fg);
            }

            .notice {
                max-width: 22rem;
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-m);
                background: var(--warning-bg);
                border: 1px solid var(--warning);
                font-size: 0.95rem;
            }
        `,
        template: html`
            <access-screen
                *if="screenState !== 'READY'"
                state="{{screenState}}"
                icon="/level.svg"
                message-id="level.explainAsk"
                unavailable-id="level.unavailable"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <default-layout *if="screenState === 'READY'">
                <div class="{{stateClass}}">
                    <div class="modes" role="group">
                        <button
                            class="{{modeClass.surface}}"
                            aria-pressed="{{modePressed.surface}}"
                            @click.stop.prevent="selectMode('surface')"
                        >
                            <i18n-label
                                id="level.mode.surface"
                                ws=""
                            ></i18n-label>
                        </button>
                        <button
                            class="{{modeClass.bars}}"
                            aria-pressed="{{modePressed.bars}}"
                            @click.stop.prevent="selectMode('bars')"
                        >
                            <i18n-label
                                id="level.mode.bars"
                                ws=""
                            ></i18n-label>
                        </button>
                    </div>
                    <div class="body">
                        <div class="stage">
                            <div *if="mode === 'surface'" class="target">
                                <svg viewBox="0 0 100 100" aria-hidden="true">
                                    <circle
                                        class="face"
                                        cx="50"
                                        cy="50"
                                        r="49"
                                    />
                                    <circle
                                        class="ring"
                                        cx="50"
                                        cy="50"
                                        r="28"
                                    />
                                    <circle
                                        class="ring"
                                        cx="50"
                                        cy="50"
                                        r="16.6"
                                    />
                                    <path class="cross" d="M50 2v96M2 50h96" />
                                    <circle
                                        class="zone"
                                        cx="50"
                                        cy="50"
                                        r="11"
                                    />
                                </svg>
                                <div
                                    class="bubble"
                                    #ref="surfaceBubbleEl"
                                ></div>
                            </div>
                            <div *if="mode === 'bars'" class="bars">
                                <div class="horizontal-slot">
                                    <div class="vial horizontal">
                                        <div
                                            class="tick minor"
                                            style="left: 24.6%"
                                        ></div>
                                        <div
                                            class="tick"
                                            style="left: 36.9%"
                                        ></div>
                                        <div
                                            class="tick"
                                            style="left: 63.1%"
                                        ></div>
                                        <div
                                            class="tick minor"
                                            style="left: 75.4%"
                                        ></div>
                                        <div
                                            class="bubble"
                                            #ref="horizontalBubbleEl"
                                        ></div>
                                    </div>
                                </div>
                                <div class="vertical-slot">
                                    <div class="{{verticalClass}}">
                                        <div
                                            class="tick minor"
                                            style="top: 24.6%"
                                        ></div>
                                        <div
                                            class="tick"
                                            style="top: 36.9%"
                                        ></div>
                                        <div
                                            class="tick"
                                            style="top: 63.1%"
                                        ></div>
                                        <div
                                            class="tick minor"
                                            style="top: 75.4%"
                                        ></div>
                                        <div
                                            class="bubble"
                                            #ref="verticalBubbleEl"
                                        ></div>
                                    </div>
                                    <div class="vial-degrees">
                                        {{verticalDegrees}}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="readout">
                            <div class="degrees">{{degrees}}</div>
                            <div class="status">
                                <i18n-label
                                    *if="statusId"
                                    id="{{statusId}}"
                                    ws=""
                                ></i18n-label>
                            </div>
                            <div *if="detailX" class="axes">
                                <span
                                    ><i18n-label
                                        id="level.axisX"
                                        ws=""
                                    ></i18n-label>
                                    <b>{{detailX}}</b></span
                                >
                                <span
                                    ><i18n-label
                                        id="level.axisY"
                                        ws=""
                                    ></i18n-label>
                                    <b>{{detailY}}</b></span
                                >
                            </div>
                            <div *if="hintId" class="notice">
                                <i18n-label id="{{hintId}}" ws=""></i18n-label>
                            </div>
                            <div *if="waiting" class="notice">
                                <i18n-label
                                    id="level.waiting"
                                    ws=""
                                ></i18n-label>
                            </div>
                        </div>
                    </div>
                </div>
                <icon-button
                    slot="more-buttons"
                    href="/reset.svg"
                    label-id="level.resetZero"
                    .disabled="!canReset"
                    @click.stop.prevent="resetCalibration()"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    href="/calibrate.svg"
                    label-id="level.setZero"
                    .disabled="!canCalibrate"
                    @click.stop.prevent="calibrate()"
                ></icon-button>
            </default-layout>
        `,
    },
    LevelAppComponent
);
