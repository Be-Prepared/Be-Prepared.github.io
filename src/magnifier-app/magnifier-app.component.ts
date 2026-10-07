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
    formatZoom,
    hardwareZoomFromCapabilities,
    HardwareZoom,
    initialZoom,
    pinchZoom,
    planZoom,
    stepZoom,
    zoomLimits,
} from './zoom';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export class MagnifierAppComponent {
    private _camera = di(CameraService).controller({ highResolution: true });
    private _hardwareZoom: HardwareZoom | null = null;
    private _hardwareZoomApplied: number | null = null;
    private _hardwareZoomPending: number | null = null;
    private _pinchStartDistance = 0;
    private _pinchStartZoom = 1;
    private _pointers = new Map<number, { x: number; y: number }>();
    private _subject = new Subject();
    private _track: MediaStreamTrack | null = null;
    private _zoom = 1;
    canZoomIn = true;
    canZoomOut = false;
    freezeIcon = '/pause.svg';
    freezeLabel = 'magnifier.freeze';
    frozen = false;
    screenState = AccessState.CHECKING;
    torchAvailable = false;
    torchEnabled = false;
    video?: HTMLVideoElement;
    zoomLabel = '';

    onInit() {
        this._camera.state
            .pipe(takeUntil(this._subject))
            .subscribe((state) => (this.screenState = state));
        this._camera.resourceChanges
            .pipe(takeUntil(this._subject))
            .subscribe((stream) => this._attach(stream));
        this._camera.init();
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._camera.destroy();
    }

    grant() {
        this._camera.request();
    }

    pointerDown(event: PointerEvent) {
        this._pointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
        });
        this._startPinch();
    }

    pointerMove(event: PointerEvent) {
        if (!this._pointers.has(event.pointerId)) {
            return;
        }

        this._pointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
        });

        if (this._pointers.size === 2) {
            this._setZoom(
                pinchZoom(
                    this._pinchStartZoom,
                    this._pinchStartDistance,
                    this._pointerDistance()
                )
            );
        }
    }

    pointerUp(event: PointerEvent) {
        this._pointers.delete(event.pointerId);
        this._startPinch();
    }

    toggleFreeze() {
        this._setFrozen(!this.frozen);

        if (this.video) {
            if (this.frozen) {
                this.video.pause();
            } else {
                this.video.play().catch(() => {});
            }
        }
    }

    toggleTorch() {
        const track = this._track;

        setTorch(track, !this.torchEnabled)
            .catch(() => {})
            .then(() => {
                this.torchEnabled = isTorchOn(track);
            });
    }

    zoomIn() {
        this._setZoom(stepZoom(this._zoom, 1));
    }

    zoomOut() {
        this._setZoom(stepZoom(this._zoom, -1));
    }

    private _applyHardwareZoom(value: number | null) {
        if (value === null || !this._track) {
            return;
        }

        if (this._hardwareZoomPending !== null) {
            // A change is in progress. Remember the latest value and apply it
            // once the camera catches up.
            this._hardwareZoomPending = value;

            return;
        }

        if (value === this._hardwareZoomApplied) {
            return;
        }

        const track = this._track;
        this._hardwareZoomPending = value;
        this._hardwareZoomApplied = value;
        track
            .applyConstraints({ advanced: [{ zoom: value } as any] })
            .catch(() => {})
            .then(() => {
                const next = this._hardwareZoomPending;
                this._hardwareZoomPending = null;

                if (track === this._track && next !== value) {
                    this._applyHardwareZoom(next);
                }
            });
    }

    private _attach(stream: MediaStream | null) {
        const track = getVideoTrack(stream);
        this._track = track;
        this._hardwareZoomApplied = null;
        this._hardwareZoomPending = null;
        this._setFrozen(false);

        if (!track) {
            this.torchAvailable = false;
            this.torchEnabled = false;

            return;
        }

        const isFirst = this._hardwareZoom === null && !this.zoomLabel;
        this._hardwareZoom = hardwareZoomFromCapabilities(
            track.getCapabilities ? track.getCapabilities() : null
        );
        this.torchAvailable = hasTorch(track);
        this.torchEnabled = isTorchOn(track);

        // Wait a tick for the video element to be rendered.
        setTimeout(() => {
            if (this.video && this._track === track) {
                this.video.srcObject = stream;
            }

            // Keep the zoom level when coming back from the background.
            this._setZoom(isFirst ? initialZoom(this._hardwareZoom) : this._zoom);
        });
    }

    private _pointerDistance() {
        const [a, b] = [...this._pointers.values()];

        if (!a || !b) {
            return 0;
        }

        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    private _setFrozen(frozen: boolean) {
        this.frozen = frozen;
        this.freezeIcon = frozen ? '/play.svg' : '/pause.svg';
        this.freezeLabel = frozen ? 'magnifier.resume' : 'magnifier.freeze';
    }

    private _setZoom(requested: number) {
        const plan = planZoom(requested, this._hardwareZoom);
        const limits = zoomLimits(this._hardwareZoom);
        this._zoom = plan.total;
        this.zoomLabel = formatZoom(plan.total);
        this.canZoomIn = plan.total < limits.max - 1e-6;
        this.canZoomOut = plan.total > limits.min + 1e-6;
        this._applyHardwareZoom(plan.hardware);

        if (this.video) {
            this.video.style.transform = `scale(${plan.digital})`;
        }
    }

    private _startPinch() {
        if (this._pointers.size === 2) {
            this._pinchStartDistance = this._pointerDistance();
            this._pinchStartZoom = this._zoom;
        }
    }
}

component(
    'magnifier-app',
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
                background: #000;
                z-index: 0;
            }

            video {
                height: 100%;
                width: 100%;
                object-fit: cover;
                transform-origin: center center;
            }

            /* Do not convert pointer events to touch events */
            default-layout {
                touch-action: none;
            }

            .zoom-label {
                position: absolute;
                top: var(--space-3);
                left: 50%;
                transform: translateX(-50%);
                padding: var(--space-1) var(--space-3);
                border-radius: 999px;
                background: var(--overlay-bg);
                color: #fff;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                pointer-events: none;
            }
        `,
        template: html`
            <access-screen
                *if="screenState !== 'READY'"
                state="{{screenState}}"
                icon="/camera.svg"
                message-id="magnifier.explainAsk"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <div *if="screenState === 'READY'" class="viewport">
                <video #ref="video" autoplay muted playsinline></video>
                <div class="zoom-label">{{zoomLabel}}</div>
            </div>
            <default-layout
                *if="screenState === 'READY'"
                overlay
                @pointerdown="pointerDown($event)"
                @pointermove="pointerMove($event)"
                @pointerup="pointerUp($event)"
                @pointercancel="pointerUp($event)"
            >
                <!-- Same order as the mirror: light, zoom, freeze. -->
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
                    href="/zoom-out.svg"
                    label-id="magnifier.zoomOut"
                    .disabled="!canZoomOut"
                    @click.stop.prevent="zoomOut()"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    href="/zoom-in.svg"
                    label-id="magnifier.zoomIn"
                    .disabled="!canZoomIn"
                    @click.stop.prevent="zoomIn()"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    href="{{freezeIcon}}"
                    label-id="{{freezeLabel}}"
                    .active="frozen"
                    @click.stop.prevent="toggleFreeze()"
                ></icon-button>
            </default-layout>
        `,
    },
    MagnifierAppComponent
);
