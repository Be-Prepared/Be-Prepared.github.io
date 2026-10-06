import {
    adjustForPixelRatio,
    CARD_LONG_MM,
    CARD_SHORT_MM,
    cardLengthToPxPerMm,
    clampPxPerMm,
    defaultPxPerMm,
    formatCm,
    formatInches,
    generateTicks,
    IMPERIAL,
    METRIC,
    nudge,
    PX_PER_MM_MAX,
    PX_PER_MM_MIN,
    Scale,
    snapToDevice,
} from './ruler';
import { calibrationStorage } from './ruler-storage';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';

// Tick lengths in CSS pixels, longest first.
const METRIC_TICKS = [30, 21, 13];
const IMPERIAL_TICKS = [30, 22, 16, 11, 7];

// How far the touch strips reach into the screen from each long edge.
const STRIP_PX = 44;

function currentRatio() {
    return window.devicePixelRatio || 1;
}

function guessPxPerMm() {
    return defaultPxPerMm({
        coarse: window.matchMedia('(pointer: coarse)').matches,
        shortSide: Math.min(window.screen.width, window.screen.height),
    });
}

export class RulerAppComponent {
    private _darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    private _i18nService = di(I18nService);
    private _lengthPx = 0;
    private _markerPx: number | null = null;
    private _portrait = true;
    private _pxPerMm = guessPxPerMm();
    private _redrawListener = () => this._scheduleDraw();
    calibrated = false;
    calibrating = false;
    canvas?: HTMLCanvasElement;
    cardHint?: HTMLElement;
    cardHintClass = 'card-hint';
    draftPxPerMm = 0;
    // Slider values are strings in the DOM.
    draftValue = '';
    readoutCm = '';
    readoutIn = '';
    stripA?: HTMLElement;
    stripB?: HTMLElement;
    wrapper?: HTMLElement;
    wrapperClass = 'wrapper';
    sliderMin = PX_PER_MM_MIN;
    sliderMax = PX_PER_MM_MAX;

    onInit() {
        const saved = calibrationStorage.getItem();

        if (saved) {
            this._pxPerMm = clampPxPerMm(
                adjustForPixelRatio(saved.pxPerMm, saved.ratio, currentRatio())
            );
            this.calibrated = true;
        }

        this._updateReadout();
    }

    onViewInit() {
        window.addEventListener('resize', this._redrawListener);
        this._darkQuery.addEventListener('change', this._redrawListener);
        this._scheduleDraw();
    }

    onDestroy() {
        window.removeEventListener('resize', this._redrawListener);
        this._darkQuery.removeEventListener('change', this._redrawListener);

        if (this._frame !== null) {
            cancelAnimationFrame(this._frame);
        }
    }

    cancelCalibration() {
        this._setCalibrating(false);
    }

    fineAdjust(steps: number) {
        this._setDraft(nudge(this.draftPxPerMm, steps));
    }

    pointerDown(event: PointerEvent) {
        const target = event.target as HTMLElement | null;

        // Buttons and sliders on the panel work normally.
        if (target && target.closest && target.closest('.panel')) {
            return;
        }

        const element = event.currentTarget as HTMLElement;

        try {
            element.setPointerCapture(event.pointerId);
        } catch (_ignore) {}

        this.pointerMove(event);
    }

    pointerMove(event: PointerEvent) {
        const element = event.currentTarget as HTMLElement;

        if (
            event.type === 'pointermove' &&
            !(element.hasPointerCapture && element.hasPointerCapture(event.pointerId))
        ) {
            return;
        }

        event.preventDefault();
        const position = this._portrait ? event.clientY : event.clientX;

        if (this.calibrating) {
            // Dragging moves the far edge of the card outline.
            this._setDraft(cardLengthToPxPerMm(position));
        } else {
            this._markerPx = Math.max(0, Math.min(this._lengthPx, position));
            this._updateReadout();
            this._scheduleDraw();
        }
    }

    resetCalibration() {
        this._setDraft(guessPxPerMm());
    }

    saveCalibration() {
        this._pxPerMm = this.draftPxPerMm;
        calibrationStorage.setItem({
            pxPerMm: this._pxPerMm,
            ratio: currentRatio(),
        });
        this.calibrated = true;
        this._setCalibrating(false);
    }

    sliderInput(value: string) {
        this._setDraft(parseFloat(value));
    }

    toggleCalibration() {
        this._setCalibrating(!this.calibrating);
    }

    private _draw() {
        const canvas = this.canvas;

        if (!canvas) {
            return;
        }

        const ratio = currentRatio();
        const width = window.innerWidth;
        const height = window.innerHeight;
        this._portrait = height >= width;
        this._measureLength();
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        this._placeStrips();
        const context = canvas.getContext('2d');

        if (!context) {
            return;
        }

        const style = getComputedStyle(canvas);
        const fg = style.getPropertyValue('--fg').trim() || '#000';
        const muted = style.getPropertyValue('--fg-muted').trim() || '#666';
        const accent = style.getPropertyValue('--accent').trim() || '#e8590c';
        const accentSoft =
            style.getPropertyValue('--accent-soft').trim() ||
            'rgba(232, 89, 12, 0.12)';
        const pxPerMm = this.calibrating ? this.draftPxPerMm : this._pxPerMm;
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (this.calibrating) {
            this._drawCard(context, pxPerMm, ratio, accent, accentSoft);
            this._placeCardHint(pxPerMm);
        }

        this._drawScale(context, METRIC, METRIC_TICKS, false, this._i18nService.get('unit.cm'), pxPerMm, ratio, fg, muted);
        this._drawScale(context, IMPERIAL, IMPERIAL_TICKS, true, this._i18nService.get('unit.in'), pxPerMm, ratio, fg, muted);

        if (!this.calibrating && this._markerPx !== null) {
            this._drawMarker(context, this._markerPx, ratio, accent);
        }
    }

    private _drawCard(
        context: CanvasRenderingContext2D,
        pxPerMm: number,
        ratio: number,
        accent: string,
        fill: string
    ) {
        const along = snapToDevice(CARD_LONG_MM * pxPerMm, ratio);
        const across = snapToDevice(CARD_SHORT_MM * pxPerMm, ratio);
        const w = this._portrait ? across : along;
        const h = this._portrait ? along : across;
        const line = Math.max(2, Math.round(2 * ratio));
        context.fillStyle = fill;
        context.fillRect(0, 0, w, h);
        context.fillStyle = accent;
        // Draw the outline inside the card area so its outer edge is exactly
        // the card's size.
        context.fillRect(0, h - line, w, line);
        context.fillRect(w - line, 0, line, h);
        context.fillRect(0, 0, w, line);
        context.fillRect(0, 0, line, h);
    }

    private _drawMarker(
        context: CanvasRenderingContext2D,
        markerPx: number,
        ratio: number,
        accent: string
    ) {
        const canvas = context.canvas;
        const line = Math.max(1, Math.round(2 * ratio));
        const at = snapToDevice(markerPx, ratio) - Math.floor(line / 2);
        context.fillStyle = accent;

        if (this._portrait) {
            context.fillRect(0, at, canvas.width, line);
        } else {
            context.fillRect(at, 0, line, canvas.height);
        }
    }

    // Side B is the right edge in portrait, the bottom in landscape.
    private _drawScale(
        context: CanvasRenderingContext2D,
        scale: Scale,
        tickLengths: number[],
        sideB: boolean,
        unit: string,
        pxPerMm: number,
        ratio: number,
        fg: string,
        muted: string
    ) {
        const canvas = context.canvas;
        const ticks = generateTicks(this._lengthPx, pxPerMm, scale);
        // Whole device pixels so every tick is equally sharp.
        const line = Math.max(1, Math.round(ratio));
        const fontPx = 13 * ratio;
        context.font = `600 ${fontPx}px system-ui, sans-serif`;

        for (const tick of ticks) {
            const at = Math.min(
                snapToDevice(tick.offset, ratio),
                (this._portrait ? canvas.height : canvas.width) - line
            );
            const length = Math.round(
                (tickLengths[tick.level] || tickLengths[tickLengths.length - 1]) *
                    ratio
            );
            context.fillStyle = tick.level ? muted : fg;

            if (this._portrait) {
                const x = sideB ? canvas.width - length : 0;
                context.fillRect(x, at, length, line);
            } else {
                const y = sideB ? canvas.height - length : 0;
                context.fillRect(at, y, line, length);
            }

            if (tick.label === null) {
                continue;
            }

            // The zero mark gets the unit name instead, nudged inward so it
            // isn't cut off by the edge.
            const text = tick.label ? `${tick.label}` : unit;
            const gap = 4 * ratio;
            const tip = Math.round(tickLengths[0] * ratio) + gap;
            context.fillStyle = fg;

            if (this._portrait) {
                context.textAlign = sideB ? 'right' : 'left';
                context.textBaseline = tick.label ? 'middle' : 'top';
                context.fillText(
                    text,
                    sideB ? canvas.width - tip : tip,
                    tick.label ? at : gap
                );
            } else {
                context.textAlign = tick.label ? 'center' : 'left';
                context.textBaseline = sideB ? 'bottom' : 'top';
                context.fillText(
                    text,
                    tick.label ? at : gap,
                    sideB ? canvas.height - tip : tip
                );
            }
        }
    }

    // The ruler runs from the screen edge to the toolbar.
    private _measureLength() {
        const full = this._portrait ? window.innerHeight : window.innerWidth;

        if (!this.wrapper) {
            this._lengthPx = full;

            return;
        }

        const rect = this.wrapper.getBoundingClientRect();
        const end = this._portrait ? rect.bottom : rect.right;
        this._lengthPx = end > 0 ? Math.min(full, end) : full;
    }

    // Instructions go inside the card outline, the one place the panel
    // can't be without hiding the edge that needs to be lined up.
    private _placeCardHint(pxPerMm: number) {
        if (!this.cardHint) {
            return;
        }

        const along = CARD_LONG_MM * pxPerMm;
        const across = CARD_SHORT_MM * pxPerMm;
        // Clear of the tick marks and their numbers.
        const inset = 64;
        const style = this.cardHint.style;
        style.left = `${this._portrait ? inset : 12}px`;
        style.top = `${this._portrait ? 12 : inset}px`;
        style.width = `${Math.max(
            0,
            (this._portrait ? across - inset : along) - 24
        )}px`;
    }

    private _placeStrips() {
        const length = `${this._lengthPx}px`;
        const thickness = `${STRIP_PX}px`;

        for (const [strip, sideB] of [
            [this.stripA, false],
            [this.stripB, true],
        ] as const) {
            if (!strip) {
                continue;
            }

            const style = strip.style;
            style.top = style.left = style.right = style.bottom = '';

            if (this._portrait) {
                style.top = '0';
                style.height = length;
                style.width = thickness;
                style[sideB ? 'right' : 'left'] = '0';
            } else {
                style.left = '0';
                style.width = length;
                style.height = thickness;
                style[sideB ? 'bottom' : 'top'] = '0';
            }
        }
    }

    private _scheduleDraw() {
        if (this._frame === null) {
            this._frame = requestAnimationFrame(() => {
                this._frame = null;
                this._draw();
            });
        }
    }

    private _setCalibrating(calibrating: boolean) {
        this.calibrating = calibrating;
        this.wrapperClass = calibrating ? 'wrapper calibrating' : 'wrapper';
        this.cardHintClass = calibrating ? 'card-hint show' : 'card-hint';

        if (calibrating) {
            this._setDraft(this._pxPerMm);
        }

        this._updateReadout();
        this._scheduleDraw();
    }

    private _setDraft(value: number) {
        this.draftPxPerMm = clampPxPerMm(value);
        this.draftValue = `${this.draftPxPerMm}`;
        this._scheduleDraw();
    }

    private _updateReadout() {
        if (this._markerPx === null) {
            this.readoutCm = '';
            this.readoutIn = '';

            return;
        }

        const mm = this._markerPx / this._pxPerMm;
        this.readoutCm = formatCm(mm);
        this.readoutIn = formatInches(mm);
    }
}

component(
    'ruler-app',
    {
        style: css`
            .scale {
                position: fixed;
                top: 0;
                left: 0;
                pointer-events: none;
            }

            .card-hint {
                position: fixed;
                display: none;
                z-index: 1;
                font-size: 0.9rem;
                pointer-events: none;
            }

            .card-hint.show {
                display: block;
            }

            .strip {
                position: fixed;
                z-index: 2;
                touch-action: none;
            }

            .wrapper {
                height: 100%;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                /* Keep clear of the tick marks along both long edges. */
                padding: 0 2.5rem;
                touch-action: none;
            }

            .wrapper.calibrating {
                justify-content: flex-end;
            }

            @media (orientation: landscape) {
                .wrapper {
                    padding: 2.5rem 0;
                }

                .wrapper.calibrating {
                    align-items: flex-end;
                    justify-content: center;
                }
            }

            .panel {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-3);
                max-width: 20rem;
                width: 100%;
                text-align: center;
                padding: var(--space-3);
                box-sizing: border-box;
                border-radius: var(--radius-l);
                background: var(--surface);
                border: 1px solid var(--border);
                box-shadow: var(--shadow);
                touch-action: auto;
            }

            .calibrating .panel {
                max-width: 16rem;
            }

            .readout {
                font-size: clamp(2rem, 10vmin, 3.5rem);
                font-weight: 700;
                line-height: 1.1;
                font-variant-numeric: tabular-nums;
            }

            .readout-sub {
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--fg-muted);
                font-variant-numeric: tabular-nums;
            }

            .hint {
                margin: 0;
                font-size: 0.95rem;
                color: var(--fg-muted);
            }

            .warning {
                margin: 0;
                font-size: 0.9rem;
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-m);
                background: var(--warning-bg);
                border: 1px solid var(--warning);
            }

            .slider {
                flex: 1 1 auto;
                min-width: 0;
                accent-color: var(--accent);
            }

            .row {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                width: 100%;
            }

            .row pretty-button {
                flex: 1 1 0;
            }

            .row pretty-button.nudge {
                flex: 0 0 var(--tap);
                font-size: 1.4rem;
            }

            .link {
                border: none;
                background: none;
                padding: var(--space-1);
                color: var(--accent);
                font: inherit;
                font-size: 0.9rem;
                text-decoration: underline;
                cursor: pointer;
            }

            @media (orientation: landscape) and (max-height: 500px) {
                .calibrating .hint {
                    font-size: 0.85rem;
                }

                .calibrating .panel {
                    gap: var(--space-2);
                    padding: var(--space-2) var(--space-3);
                }
            }
        `,
        template: html`
            <canvas class="scale" #ref="canvas"></canvas>
            <default-layout>
                <icon-button
                    slot="more-buttons"
                    href="/calibrate.svg"
                    label-id="ruler.calibrate"
                    .active="calibrating"
                    @click.stop.prevent="toggleCalibration()"
                ></icon-button>
                <div
                    class="{{wrapperClass}}"
                    #ref="wrapper"
                    @pointerdown="pointerDown($event)"
                    @pointermove="pointerMove($event)"
                >
                    <div *if="!calibrating" class="panel">
                        <div *if="readoutCm" class="readout">{{readoutCm}}</div>
                        <div *if="readoutIn" class="readout-sub">
                            {{readoutIn}}
                        </div>
                        <p *if="!readoutCm" class="hint">
                            <i18n-label id="ruler.howTo" ws=""></i18n-label>
                        </p>
                        <p *if="!calibrated" class="warning">
                            <i18n-label
                                id="ruler.notCalibrated"
                                ws=""
                            ></i18n-label>
                        </p>
                        <pretty-button
                            *if="!calibrated"
                            variant="primary"
                            @click.stop.prevent="toggleCalibration()"
                            ><i18n-label id="ruler.calibrate" ws=""></i18n-label
                        ></pretty-button>
                    </div>
                    <div *if="calibrating" class="panel">
                        <div class="row">
                            <pretty-button
                                class="nudge"
                                padding="0"
                                @click.stop.prevent="fineAdjust(-1)"
                                >−</pretty-button
                            >
                            <input
                                class="slider"
                                type="range"
                                min="{{sliderMin}}"
                                max="{{sliderMax}}"
                                step="0.001"
                                value="{{draftValue}}"
                                @input="sliderInput($event.target.value)"
                            />
                            <pretty-button
                                class="nudge"
                                padding="0"
                                @click.stop.prevent="fineAdjust(1)"
                                >+</pretty-button
                            >
                        </div>
                        <div class="row">
                            <pretty-button
                                @click.stop.prevent="cancelCalibration()"
                                ><i18n-label
                                    id="ruler.cancel"
                                    ws=""
                                ></i18n-label
                            ></pretty-button>
                            <pretty-button
                                variant="primary"
                                @click.stop.prevent="saveCalibration()"
                                ><i18n-label
                                    id="ruler.save"
                                    ws=""
                                ></i18n-label
                            ></pretty-button>
                        </div>
                        <button
                            class="link"
                            @click.stop.prevent="resetCalibration()"
                        >
                            <i18n-label
                                id="ruler.resetCalibration"
                                ws=""
                            ></i18n-label>
                        </button>
                    </div>
                </div>
            </default-layout>
            <div class="{{cardHintClass}}" #ref="cardHint">
                <i18n-label id="ruler.calibrateHowTo" ws=""></i18n-label>
            </div>
            <div
                class="strip"
                #ref="stripA"
                @pointerdown="pointerDown($event)"
                @pointermove="pointerMove($event)"
            ></div>
            <div
                class="strip"
                #ref="stripB"
                @pointerdown="pointerDown($event)"
                @pointermove="pointerMove($event)"
            ></div>
        `,
    },
    RulerAppComponent
);
