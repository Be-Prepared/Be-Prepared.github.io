import { AccessState } from '../services/access/access-controller';
import {
    CameraService,
    getVideoTrack,
    hasTorch,
    isTorchOn,
    setTorch,
} from '../services/camera.service';
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
    screenToProtractor,
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
const SVG_NS = 'http://www.w3.org/2000/svg';

export class ProtractorAppComponent {
    private _camera = di(CameraService).controller();
    private _drag: Drag | null = null;
    // SVG parts are created once and only updated afterwards. Replacing them
    // while a finger is on a handle ends the drag on iPhones, where touch
    // events stay with the element the touch started on.
    private _elements: { [name: string]: SVGElement } = {};
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    // Size of the protractor's own drawing area. In portrait it's drawn
    // turned on its side, so this is the stage's height by its width.
    private _height = 0;
    private _layout: Layout | null = null;
    private _portrait = false;
    private _rayTop = 0;
    // Drawing space kept clear at the left end (screen top in portrait) for
    // the reading and any camera notice.
    private _start = 0;
    private _rays: number[] = [...INITIAL_RAYS];
    private _resizeObserver: ResizeObserver | null = null;
    // Fudgel's style scoping classes, copied onto created SVG elements.
    private _scope = '';
    private _subject = new Subject();
    private _track: MediaStreamTrack | null = null;
    private _width = 0;
    angle = '';
    cameraReady = false;
    leftRay = '';
    rightRay = '';
    noticeId = '';
    showEnable = false;
    stage?: HTMLElement;
    svg?: SVGSVGElement;
    torchAvailable = false;
    torchEnabled = false;
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
        if (!this.stage || !this.svg) {
            return;
        }

        this._buildSvg(this.svg);
        // Covers rotation, window resizing and the toolbar moving sides.
        this._resizeObserver = new ResizeObserver(() => this._measure());
        this._resizeObserver.observe(this.stage);
        // The reading grows when a camera notice appears.
        const overlay = this.stage.querySelector('.top');

        if (overlay) {
            this._resizeObserver.observe(overlay);
        }

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

        event.preventDefault();
        const angle = this._pointerAngle(event);
        const ray = nearestRay(this._rays, angle);
        this._drag = {
            pointerId: event.pointerId,
            pointerStart: angle,
            ray,
            rayStart: this._rays[ray],
        };

        // Keep getting moves when the finger slides over the toolbar or off
        // the handle.
        try {
            this.stage?.setPointerCapture(event.pointerId);
        } catch (e) {
            // The pointer is already gone.
        }
    }

    pointerMove(event: PointerEvent) {
        const drag = this._drag;

        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
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

    toggleTorch() {
        const track = this._track;

        setTorch(track, !this.torchEnabled)
            .catch(() => {})
            .then(() => {
                this.torchEnabled = isTorchOn(track);
            });
    }

    private _attach(stream: MediaStream | null) {
        this.cameraReady = !!stream;
        const track = getVideoTrack(stream);
        this._track = track;
        this.torchAvailable = hasTorch(track);
        this.torchEnabled = isTorchOn(track);

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

    private _buildSvg(svg: SVGSVGElement) {
        // Elements made here miss the classes Fudgel adds to template
        // elements for style scoping. The svg has them, so copy them.
        const scope = svg.getAttribute('class') || '';
        const make = (tag: string, className: string, parent: Element) => {
            const element = document.createElementNS(SVG_NS, tag) as SVGElement;
            element.setAttribute('class', `${scope} ${className}`);
            parent.appendChild(element);

            return element;
        };
        const root = make('g', 'protractor', svg);
        this._elements = {
            root,
            wedge: make('path', 'wedge', root),
            arc: make('path', 'arc', root),
            scale: make('path', 'scale', root),
            ticks: make('path', 'ticks', root),
            labels: make('g', 'labels', root),
            base: make('line', 'base', root),
            ray0: make('line', 'ray ray-0', root),
            ray1: make('line', 'ray ray-1', root),
            handle0: make('circle', 'handle', root),
            handle1: make('circle', 'handle', root),
            vertex: make('circle', 'vertex', root),
        };
        this._elements.handle0.setAttribute('r', `${HANDLE_RADIUS}`);
        this._elements.handle1.setAttribute('r', `${HANDLE_RADIUS}`);
        this._elements.vertex.setAttribute('r', '5');
        this._scope = scope;
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
        const geometry = this._layout;
        const e = this._elements;
        this._updateReadout();

        if (!geometry || !e.root) {
            return;
        }

        const { vertex, radius } = geometry;
        const [a, b] = this._rays;
        e.wedge.setAttribute('d', wedgePath(vertex, radius, a, b));
        e.arc.setAttribute('d', arcPath(vertex, radius * 0.32, a, b));

        this._rays.forEach((ray, index) => {
            const length = rayLength(
                vertex,
                ray,
                this._width,
                {
                    side: HANDLE_RADIUS + 6,
                    start: this._start,
                    top: this._rayTop,
                },
                radius + 4
            );
            const end = pointAt(vertex, ray, length);
            const line = e[`ray${index}`];
            line.setAttribute('x1', `${vertex.x}`);
            line.setAttribute('y1', `${vertex.y}`);
            line.setAttribute('x2', `${end.x}`);
            line.setAttribute('y2', `${end.y}`);
            const handle = e[`handle${index}`];
            handle.setAttribute('cx', `${end.x}`);
            handle.setAttribute('cy', `${end.y}`);
        });
    }

    // Size-dependent parts that don't change while dragging.
    private _drawScale() {
        const geometry = this._layout;
        const e = this._elements;

        if (!geometry || !e.root || !this.svg) {
            return;
        }

        const { vertex, radius, baseY } = geometry;
        const stageWidth = this._portrait ? this._height : this._width;
        const stageHeight = this._portrait ? this._width : this._height;
        this.svg.setAttribute('viewBox', `0 0 ${stageWidth} ${stageHeight}`);
        // Portrait: turn the drawing so its base runs along the long left
        // edge and it opens to the right. Screen (x, y) = (height - y, x).
        e.root.setAttribute(
            'transform',
            this._portrait ? `matrix(0 1 -1 0 ${this._height} 0)` : ''
        );
        e.scale.setAttribute('d', arcPath(vertex, radius, 0, 180));
        e.ticks.setAttribute(
            'd',
            ticks(vertex, radius)
                .map((t) => `M${t.from.x} ${t.from.y}L${t.to.x} ${t.to.y}`)
                .join('')
        );
        e.base.setAttribute('x1', '0');
        e.base.setAttribute('y1', `${baseY}`);
        e.base.setAttribute('x2', `${this._width}`);
        e.base.setAttribute('y2', `${baseY}`);
        e.vertex.setAttribute('cx', `${vertex.x}`);
        e.vertex.setAttribute('cy', `${vertex.y}`);

        const labels = e.labels;

        while (labels.firstChild) {
            labels.firstChild.remove();
        }

        for (const degrees of labelAngles(radius)) {
            // 0 and 180 would sit on the base bar, so they go beside it at
            // the ends of the scale.
            const flat = degrees === 0 || degrees === 180;
            const p = pointAt(vertex, degrees, radius * (flat ? 1 : 0.8));
            const y = flat ? baseY + 13 : p.y;
            const text = document.createElementNS(SVG_NS, 'text');
            text.setAttribute('class', `${this._scope} scale-label`);
            text.setAttribute('x', `${p.x}`);
            text.setAttribute('y', `${y}`);

            if (this._portrait) {
                // Keep numbers upright when the drawing is turned.
                text.setAttribute('transform', `rotate(-90 ${p.x} ${y})`);
            }

            text.textContent = `${degrees}`;
            labels.appendChild(text);
        }
    }

    private _measure() {
        const rect = this.stage?.getBoundingClientRect();

        if (!rect || !rect.width || !rect.height) {
            return;
        }

        // Use the long edge of the screen for the base, so the protractor
        // is as big as possible.
        this._portrait = rect.height > rect.width;
        this._width = this._portrait ? rect.height : rect.width;
        this._height = this._portrait ? rect.width : rect.height;

        if (this._portrait) {
            // The reading (and any camera notice) sits at the top of the
            // screen, which is the 180° end of the base when turned. Center
            // the protractor in the space below it.
            const overlay = this.stage?.querySelector('.top') as HTMLElement | null;
            this._start = (overlay?.offsetHeight || 80) + 8;
            this._layout = layout(this._width - this._start, this._height, {
                bottom: 28,
                side: 24,
                top: 24,
            });
            this._layout.vertex.x += this._start;
            this._rayTop = HANDLE_RADIUS + 6;
        } else {
            this._start = HANDLE_RADIUS + 6;
            this._layout = layout(this._width, this._height, {
                bottom: 28,
                side: 24,
                top: Math.min(120, this._height * 0.3),
            });
            // Keep handles out from under the reading at the top.
            this._rayTop = Math.min(90, this._height * 0.25);
        }

        this._drawScale();
        this._scheduleDraw();
    }

    private _pointerAngle(event: PointerEvent) {
        const rect = this.stage!.getBoundingClientRect();
        const point = screenToProtractor(
            {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            },
            this._portrait,
            this._height
        );

        return pointerAngle(this._layout!.vertex, point);
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
                -webkit-touch-callout: none;
                /* Dragging a ray must never scroll or zoom the page. */
                touch-action: none;
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
                    *if="torchAvailable"
                    href="/flashlight.svg"
                    label-id="shared.torch"
                    .active="torchEnabled"
                    @click.stop.prevent="toggleTorch()"
                ></icon-button>
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
