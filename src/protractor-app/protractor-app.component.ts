import { AccessState } from '../services/access/access-controller';
import { CameraService } from '../services/camera.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import {
    angleBetween,
    angleFromBase,
    arcPath,
    dragAngle,
    formatDegrees,
    INITIAL_RAYS,
    labelAngles,
    layout,
    Layout,
    nearestRay,
    pointAt,
    pointerAngle,
    rayLength,
    ticks,
    wedgePath,
} from './protractor-geometry';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Drag {
    pointerId: number;
    pointerStart: number;
    ray: number;
    rayStart: number;
}

const HANDLE_RADIUS = 14;

export class ProtractorAppComponent {
    private _camera = di(CameraService).controller();
    private _drag: Drag | null = null;
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    private _height = 0;
    private _layout: Layout | null = null;
    private _rayTop = 0;
    private _rays: number[] = [...INITIAL_RAYS];
    private _resizeObserver: ResizeObserver | null = null;
    private _subject = new Subject();
    private _width = 0;
    angle = '';
    cameraReady = false;
    leftRay = '';
    rightRay = '';
    noticeId = '';
    showEnable = false;
    stage?: HTMLElement;
    svg?: SVGSVGElement;
    video?: HTMLVideoElement;

    onInit() {
        this._camera.state
            .pipe(takeUntil(this._subject))
            .subscribe((state) => this._cameraState(state));
        this._camera.resourceChanges
            .pipe(takeUntil(this._subject))
            .subscribe((stream) => this._attach(stream));
        this._camera.init();
        this._updateReadout();
    }

    onViewInit() {
        if (!this.stage) {
            return;
        }

        // Covers rotation, window resizing and the toolbar moving sides.
        this._resizeObserver = new ResizeObserver(() => this._measure());
        this._resizeObserver.observe(this.stage);
        this._measure();
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._camera.destroy();
        this._resizeObserver?.disconnect();

        if (this._frame !== null) {
            cancelAnimationFrame(this._frame);
        }
    }

    enableCamera() {
        this._camera.request();
    }

    pointerDown(event: PointerEvent) {
        if (
            this._drag ||
            !this._layout ||
            (event.target as Element)?.closest?.('.notice')
        ) {
            return;
        }

        const angle = this._pointerAngle(event);
        const ray = nearestRay(this._rays, angle);
        this._drag = {
            pointerId: event.pointerId,
            pointerStart: angle,
            ray,
            rayStart: this._rays[ray],
        };

        // Keep getting moves when the finger slides over the toolbar.
        try {
            (event.currentTarget as Element).setPointerCapture(event.pointerId);
        } catch (e) {
            // The pointer is already gone.
        }
    }

    pointerMove(event: PointerEvent) {
        const drag = this._drag;

        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        this._rays[drag.ray] = dragAngle(
            drag.rayStart,
            drag.pointerStart,
            this._pointerAngle(event)
        );
        this._scheduleDraw();
    }

    pointerUp(event: PointerEvent) {
        if (this._drag && this._drag.pointerId === event.pointerId) {
            this._drag = null;
        }
    }

    reset() {
        this._rays = [...INITIAL_RAYS];
        this._scheduleDraw();
    }

    private _attach(stream: MediaStream | null) {
        this.cameraReady = !!stream;

        if (!stream) {
            return;
        }

        // Wait a tick for the video element to be rendered.
        setTimeout(() => {
            if (this.video && this._camera.resource === stream) {
                this.video.srcObject = stream;
            }
        });
    }

    // The protractor works without the camera, so problems are a small note
    // instead of a blocking screen.
    private _cameraState(state: AccessState) {
        switch (state) {
            case AccessState.PROMPT:
                this.noticeId = 'protractor.cameraOff';
                this.showEnable = true;
                break;

            case AccessState.DENIED:
                this.noticeId = 'protractor.cameraBlocked';
                this.showEnable = true;
                break;

            case AccessState.ERROR:
                this.noticeId = 'protractor.cameraError';
                this.showEnable = true;
                break;

            case AccessState.UNAVAILABLE:
                this.noticeId = 'protractor.noCamera';
                this.showEnable = false;
                break;

            default:
                this.noticeId = '';
                this.showEnable = false;
        }
    }

    private _draw() {
        const svg = this.svg;
        const geometry = this._layout;
        this._updateReadout();

        if (!svg || !geometry) {
            return;
        }

        const { vertex, radius, baseY } = geometry;
        const [a, b] = this._rays;
        const parts: string[] = [];
        // Elements made here miss the classes Fudgel adds to template
        // elements for style scoping. The svg has them, so copy them.
        const scope = svg.getAttribute('class') || '';

        parts.push(
            `<path class="${scope} wedge" d="${wedgePath(vertex, radius, a, b)}"/>`,
            `<path class="${scope} arc" d="${arcPath(
                vertex,
                radius * 0.32,
                a,
                b
            )}"/>`,
            `<path class="${scope} scale" d="${arcPath(vertex, radius, 0, 180)}"/>`
        );

        const tickPath = ticks(vertex, radius)
            .map((t) => `M${t.from.x} ${t.from.y}L${t.to.x} ${t.to.y}`)
            .join('');
        parts.push(`<path class="${scope} ticks" d="${tickPath}"/>`);

        for (const degrees of labelAngles(radius)) {
            // 0 and 180 would sit on the base bar, so they go under it at
            // the ends of the scale.
            const flat = degrees === 0 || degrees === 180;
            const p = pointAt(vertex, degrees, radius * (flat ? 1 : 0.8));
            const y = flat ? baseY + 13 : p.y;
            parts.push(
                `<text class="${scope} scale-label" x="${p.x}" y="${y}">${degrees}</text>`
            );
        }

        parts.push(
            `<line class="${scope} base" x1="0" y1="${baseY}" x2="${this._width}" y2="${baseY}"/>`
        );

        this._rays.forEach((ray, index) => {
            const length = rayLength(
                vertex,
                ray,
                this._width,
                { side: HANDLE_RADIUS + 6, top: this._rayTop },
                radius + 4
            );
            const end = pointAt(vertex, ray, length);
            parts.push(
                `<line class="${scope} ray ray-${index}" x1="${vertex.x}" y1="${vertex.y}" x2="${end.x}" y2="${end.y}"/>`,
                `<circle class="${scope} handle" cx="${end.x}" cy="${end.y}" r="${HANDLE_RADIUS}"/>`
            );
        });

        parts.push(
            `<circle class="${scope} vertex" cx="${vertex.x}" cy="${vertex.y}" r="5"/>`
        );
        svg.setAttribute('viewBox', `0 0 ${this._width} ${this._height}`);
        svg.innerHTML = parts.join('');
    }

    private _measure() {
        const rect = this.stage?.getBoundingClientRect();

        if (!rect || !rect.width || !rect.height) {
            return;
        }

        this._width = rect.width;
        this._height = rect.height;
        this._layout = layout(rect.width, rect.height, {
            bottom: 28,
            side: 24,
            top: Math.min(120, rect.height * 0.3),
        });
        // Keep handles out from under the reading at the top.
        this._rayTop = Math.min(90, rect.height * 0.25);
        this._scheduleDraw();
    }

    private _pointerAngle(event: PointerEvent) {
        const rect = this.stage!.getBoundingClientRect();

        return pointerAngle(this._layout!.vertex, {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        });
    }

    private _scheduleDraw() {
        if (this._frame === null) {
            this._frame = requestAnimationFrame(() => {
                this._frame = null;
                this._draw();
            });
        }
    }

    private _updateReadout() {
        const [a, b] = this._rays;
        this.angle = formatDegrees(angleBetween(a, b));
        // Larger angles point further left on screen.
        this.leftRay = formatDegrees(angleFromBase(Math.max(a, b)));
        this.rightRay = formatDegrees(angleFromBase(Math.min(a, b)));
    }
}

component(
    'protractor-app',
    {
        style: css`
            :host {
                display: block;
                height: 100%;
                width: 100%;
            }

            .viewport {
                position: absolute;
                inset: 0;
                overflow: hidden;
                background: var(--bg);
                z-index: 0;
            }

            video {
                height: 100%;
                width: 100%;
                object-fit: cover;
            }

            /* Do not convert pointer events to touch events */
            default-layout {
                touch-action: none;
            }

            .stage {
                position: relative;
                height: 100%;
                width: 100%;
                user-select: none;
                -webkit-user-select: none;
                cursor: grab;
            }

            svg {
                position: absolute;
                inset: 0;
                height: 100%;
                width: 100%;
                overflow: visible;
            }

            .top {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-2);
                pointer-events: none;
            }

            .angle {
                padding: var(--space-1) var(--space-4);
                border-radius: var(--radius-l);
                background: var(--overlay-bg);
                color: #fff;
                font-size: clamp(2.25rem, 9vmin, 3.5rem);
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                line-height: 1.2;
            }

            .readings {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--space-2);
            }

            /* Each ray's angle from the base bar, on the ray's side. */
            .ray-reading {
                min-width: 4.5em;
                padding: var(--space-1) var(--space-2);
                border-radius: var(--radius-m);
                background: var(--overlay-bg);
                color: #fff;
                font-size: 1rem;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                text-align: center;
            }

            .notice {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: center;
                gap: var(--space-2);
                max-width: 24rem;
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-m);
                background: var(--warning-bg);
                border: 1px solid var(--warning);
                color: var(--fg);
                font-size: 0.85rem;
                text-align: center;
                pointer-events: auto;
            }

            .notice pretty-button {
                font-size: 0.85rem;
            }

            /* Text gets a halo so it reads over any camera picture. */
            text {
                font-family: inherit;
                paint-order: stroke;
                stroke: var(--bg);
                stroke-linejoin: round;
                text-anchor: middle;
                dominant-baseline: middle;
                fill: var(--fg);
            }

            .scale-label {
                font-size: 12px;
                stroke-width: 3px;
            }

            .wedge {
                fill: var(--accent-soft);
                opacity: 0.7;
            }

            .arc {
                fill: none;
                stroke: var(--accent);
                stroke-width: 3;
            }

            .scale,
            .ticks {
                fill: none;
                stroke: var(--fg);
                stroke-width: 1.5;
            }

            .base {
                stroke: var(--fg);
                stroke-width: 3;
            }

            .ray {
                stroke: var(--accent);
                stroke-width: 3;
                stroke-linecap: round;
            }

            .handle {
                fill: var(--accent);
                stroke: var(--bg);
                stroke-width: 2;
            }

            .vertex {
                fill: var(--fg);
            }
        `,
        template: html`
            <div class="viewport">
                <video
                    *if="cameraReady"
                    #ref="video"
                    autoplay
                    muted
                    playsinline
                ></video>
            </div>
            <default-layout overlay>
                <div
                    class="stage"
                    #ref="stage"
                    @pointerdown="pointerDown($event)"
                    @pointermove="pointerMove($event)"
                    @pointerup="pointerUp($event)"
                    @pointercancel="pointerUp($event)"
                >
                    <svg #ref="svg" xmlns="http://www.w3.org/2000/svg"></svg>
                    <div class="top">
                        <div class="readings">
                            <div class="ray-reading">{{leftRay}}</div>
                            <div class="angle">{{angle}}</div>
                            <div class="ray-reading">{{rightRay}}</div>
                        </div>
                        <div *if="noticeId" class="notice">
                            <i18n-label id="{{noticeId}}" ws=""></i18n-label>
                            <pretty-button
                                *if="showEnable"
                                @click.stop.prevent="enableCamera()"
                                ><i18n-label
                                    id="protractor.enableCamera"
                                    ws=""
                                ></i18n-label
                            ></pretty-button>
                        </div>
                    </div>
                </div>
                <icon-button
                    slot="more-buttons"
                    href="/reset.svg"
                    label-id="protractor.reset"
                    @click.stop.prevent="reset()"
                ></icon-button>
            </default-layout>
        `,
    },
    ProtractorAppComponent
);
